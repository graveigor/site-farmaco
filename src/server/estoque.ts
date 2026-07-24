import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { regraNegocio } from "@/lib/api";

type Tx = Prisma.TransactionClient;

/**
 * Saldo disponivel de um produto = soma dos lotes nao bloqueados, nao vencidos,
 * descontando o que ja esta reservado por pedidos aprovados.
 */
export async function disponivelPorProduto(produtoId: string, tx: Tx | typeof prisma = prisma) {
  const lotes = await tx.lote.findMany({
    where: { produtoId, bloqueado: false, dataValidade: { gt: new Date() } },
  });
  return lotes.reduce((s, l) => s + (l.quantidade - l.quantidadeReservada), 0);
}

/** Saldo total em estoque (inclui reservado), usado em relatorios. */
export async function saldoTotal(produtoId: string, tx: Tx | typeof prisma = prisma) {
  const r = await tx.lote.aggregate({ where: { produtoId }, _sum: { quantidade: true } });
  return r._sum.quantidade ?? 0;
}

/**
 * Seleciona lotes por FEFO (First Expired, First Out) — regra padrao em
 * distribuicao farmaceutica: sai primeiro o lote que vence antes.
 */
export async function sugerirLotesFEFO(
  produtoId: string,
  quantidade: number,
  tx: Tx | typeof prisma = prisma,
): Promise<{ loteId: string; codigo: string; quantidade: number; localizacao: string | null }[]> {
  const lotes = await tx.lote.findMany({
    where: { produtoId, bloqueado: false, dataValidade: { gt: new Date() } },
    orderBy: { dataValidade: "asc" },
  });

  const alocacao: { loteId: string; codigo: string; quantidade: number; localizacao: string | null }[] = [];
  let restante = quantidade;

  for (const lote of lotes) {
    if (restante <= 0) break;
    const livre = lote.quantidade - lote.quantidadeReservada;
    if (livre <= 0) continue;
    const usar = Math.min(livre, restante);
    alocacao.push({ loteId: lote.id, codigo: lote.codigo, quantidade: usar, localizacao: lote.localizacao });
    restante -= usar;
  }

  if (restante > 0) {
    throw regraNegocio(`Estoque insuficiente: faltam ${restante} unidade(s) disponíveis.`);
  }
  return alocacao;
}

/** Reserva estoque para um pedido aprovado (nao baixa, apenas bloqueia). */
export async function reservar(tx: Tx, produtoId: string, quantidade: number) {
  const alocacao = await sugerirLotesFEFO(produtoId, quantidade, tx);
  for (const a of alocacao) {
    await tx.lote.update({
      where: { id: a.loteId },
      data: { quantidadeReservada: { increment: a.quantidade } },
    });
  }
  return alocacao;
}

/** Libera reserva (cancelamento de pedido). */
export async function liberarReserva(tx: Tx, loteId: string, quantidade: number) {
  const lote = await tx.lote.findUnique({ where: { id: loteId } });
  if (!lote) return;
  await tx.lote.update({
    where: { id: loteId },
    data: { quantidadeReservada: { decrement: Math.min(quantidade, lote.quantidadeReservada) } },
  });
}

/**
 * Baixa efetiva de estoque com registro de movimento. Usado na expedicao e nas
 * perdas. `quantidade` positiva = entrada, negativa = saida.
 */
export async function movimentar(
  tx: Tx,
  params: {
    produtoId: string;
    loteId?: string | null;
    quantidade: number;
    tipo: string;
    origem?: string;
    origemId?: string;
    motivo?: string;
    usuarioId?: string | null;
    consumirReserva?: boolean;
  },
) {
  const { produtoId, loteId, quantidade, consumirReserva } = params;

  if (loteId) {
    const lote = await tx.lote.findUnique({ where: { id: loteId } });
    if (!lote) throw regraNegocio("Lote não encontrado.");
    const novaQtd = lote.quantidade + quantidade;
    if (novaQtd < 0) throw regraNegocio(`Saldo insuficiente no lote ${lote.codigo}.`);

    await tx.lote.update({
      where: { id: loteId },
      data: {
        quantidade: novaQtd,
        ...(consumirReserva
          ? { quantidadeReservada: { decrement: Math.min(Math.abs(quantidade), lote.quantidadeReservada) } }
          : {}),
      },
    });
  }

  const saldoApos = await saldoTotal(produtoId, tx);

  await tx.movimentoEstoque.create({
    data: {
      produtoId,
      loteId: loteId ?? null,
      tipo: params.tipo,
      quantidade,
      saldoApos,
      origem: params.origem ?? null,
      origemId: params.origemId ?? null,
      motivo: params.motivo ?? null,
      usuarioId: params.usuarioId ?? null,
    },
  });

  return saldoApos;
}

/**
 * Recalcula o custo medio ponderado do produto apos uma entrada.
 * custoNovo = (saldoAtual * custoAtual + qtdEntrada * custoEntrada) / (saldo + qtd)
 */
export async function atualizarCustoMedio(
  tx: Tx,
  produtoId: string,
  quantidadeEntrada: number,
  custoEntrada: number,
  usuarioId?: string | null,
) {
  const produto = await tx.produto.findUnique({ where: { id: produtoId } });
  if (!produto) return;

  const saldoAnterior = Math.max(0, (await saldoTotal(produtoId, tx)) - quantidadeEntrada);
  const total = saldoAnterior + quantidadeEntrada;
  const custoNovo =
    total > 0 ? (saldoAnterior * produto.custoMedio + quantidadeEntrada * custoEntrada) / total : custoEntrada;

  if (Math.abs(custoNovo - produto.custoMedio) < 0.001) return;

  await tx.produto.update({ where: { id: produtoId }, data: { custoMedio: custoNovo } });
  await tx.historicoPreco.create({
    data: {
      produtoId,
      tipo: "CUSTO",
      valorAnterior: produto.custoMedio,
      valorNovo: custoNovo,
      motivo: "Recálculo por entrada de mercadoria",
      usuarioId: usuarioId ?? null,
    },
  });
}

/** Indicadores de estoque usados no dashboard e nos alertas. */
export async function alertasEstoque() {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + 90);

  const [vencidos, aVencer, produtos] = await Promise.all([
    prisma.lote.findMany({
      where: { dataValidade: { lt: hoje }, quantidade: { gt: 0 } },
      include: { produto: { select: { nomeComercial: true, sku: true } } },
      orderBy: { dataValidade: "asc" },
      take: 50,
    }),
    prisma.lote.findMany({
      where: { dataValidade: { gte: hoje, lte: limite }, quantidade: { gt: 0 } },
      include: { produto: { select: { nomeComercial: true, sku: true } } },
      orderBy: { dataValidade: "asc" },
      take: 50,
    }),
    prisma.produto.findMany({
      where: { status: "ATIVO" },
      include: { lotes: { select: { quantidade: true } } },
    }),
  ]);

  const comSaldo = produtos.map((p) => ({
    id: p.id,
    sku: p.sku,
    nome: p.nomeComercial,
    estoqueMinimo: p.estoqueMinimo,
    saldo: p.lotes.reduce((s, l) => s + l.quantidade, 0),
  }));

  return {
    vencidos,
    aVencer,
    estoqueZerado: comSaldo.filter((p) => p.saldo === 0),
    estoqueBaixo: comSaldo.filter((p) => p.saldo > 0 && p.saldo <= p.estoqueMinimo),
  };
}
