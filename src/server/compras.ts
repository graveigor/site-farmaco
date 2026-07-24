import { prisma } from "@/lib/db";
import { naoEncontrado, regraNegocio } from "@/lib/api";
import { TRANSICOES_PEDIDO_COMPRA, type StatusPedidoCompra } from "@/lib/constants";
import { proximoNumero } from "@/lib/utils";
import { atualizarCustoMedio, movimentar } from "./estoque";

/**
 * Fluxo de compras: Suprimentos cria -> Diretoria/Gerencia aprova -> Logistica
 * recebe (gera lotes e movimenta estoque) -> Financeiro recebe o contas a pagar.
 */

export async function gerarNumeroPedidoCompra() {
  const ultimo = await prisma.pedidoCompra.findFirst({ orderBy: { numero: "desc" }, select: { numero: true } });
  return proximoNumero("PC", ultimo?.numero);
}

export async function transicionarCompra(
  pedidoId: string,
  novoStatus: StatusPedidoCompra,
  usuarioId: string,
) {
  const pedido = await prisma.pedidoCompra.findUnique({
    where: { id: pedidoId },
    include: { itens: true, fornecedor: true },
  });
  if (!pedido) throw naoEncontrado("Pedido de compra");

  const atual = pedido.status as StatusPedidoCompra;
  if (!(TRANSICOES_PEDIDO_COMPRA[atual] ?? []).includes(novoStatus)) {
    throw regraNegocio(`Transição inválida: ${atual} -> ${novoStatus}.`);
  }

  return prisma.$transaction(async (tx) => {
    if (novoStatus === "APROVADO") {
      // Aprovado gera o compromisso financeiro no contas a pagar.
      const vencimento = new Date();
      vencimento.setDate(vencimento.getDate() + (pedido.fornecedor.prazoEntregaDias || 7) + 30);

      await tx.contaPagar.create({
        data: {
          descricao: `Compra ${pedido.numero} - ${pedido.fornecedor.razaoSocial}`,
          fornecedorId: pedido.fornecedorId,
          pedidoCompraId: pedido.id,
          valor: pedido.valorTotal,
          vencimento,
          documento: pedido.numero,
        },
      });

      return tx.pedidoCompra.update({
        where: { id: pedido.id },
        data: { status: novoStatus, aprovadorId: usuarioId, aprovadoEm: new Date() },
      });
    }

    if (novoStatus === "CANCELADO" || novoStatus === "REJEITADO") {
      await tx.contaPagar.updateMany({
        where: { pedidoCompraId: pedido.id, status: "ABERTA" },
        data: { status: "CANCELADA" },
      });
    }

    return tx.pedidoCompra.update({ where: { id: pedido.id }, data: { status: novoStatus } });
  });
}

/**
 * Recebimento de mercadoria pela Logistica: cria/atualiza lotes com validade,
 * movimenta o estoque e recalcula o custo medio do produto.
 */
export async function receberMercadoria(
  pedidoId: string,
  itens: {
    itemId: string;
    quantidadeRecebida: number;
    loteCodigo: string;
    dataValidade: Date;
    localizacao?: string | null;
  }[],
  usuarioId: string,
) {
  const pedido = await prisma.pedidoCompra.findUnique({ where: { id: pedidoId }, include: { itens: true } });
  if (!pedido) throw naoEncontrado("Pedido de compra");
  if (!["APROVADO", "RECEBIDO_PARCIAL"].includes(pedido.status)) {
    throw regraNegocio("Somente pedidos aprovados podem ser recebidos.");
  }

  return prisma.$transaction(
    async (tx) => {
      for (const recebido of itens) {
        const item = pedido.itens.find((i) => i.id === recebido.itemId);
        if (!item) throw regraNegocio("Item não pertence a este pedido.");

        const saldoPendente = item.quantidade - item.quantidadeRecebida;
        if (recebido.quantidadeRecebida > saldoPendente) {
          throw regraNegocio(`Quantidade recebida maior que a pendente (${saldoPendente}).`);
        }
        if (recebido.dataValidade <= new Date()) {
          throw regraNegocio(`Lote ${recebido.loteCodigo} está vencido e não pode ser recebido.`);
        }

        // Um lote e identificado por produto + codigo; recebimentos parciais
        // do mesmo lote somam na mesma linha.
        const lote = await tx.lote.upsert({
          where: { produtoId_codigo: { produtoId: item.produtoId, codigo: recebido.loteCodigo } },
          create: {
            produtoId: item.produtoId,
            codigo: recebido.loteCodigo,
            dataValidade: recebido.dataValidade,
            quantidade: 0,
            custoUnitario: item.precoUnitario,
            localizacao: recebido.localizacao ?? null,
          },
          update: { custoUnitario: item.precoUnitario, localizacao: recebido.localizacao ?? undefined },
        });

        await movimentar(tx, {
          produtoId: item.produtoId,
          loteId: lote.id,
          quantidade: recebido.quantidadeRecebida,
          tipo: "ENTRADA",
          origem: "PEDIDO_COMPRA",
          origemId: pedido.id,
          motivo: `Recebimento da compra ${pedido.numero}`,
          usuarioId,
        });

        await atualizarCustoMedio(tx, item.produtoId, recebido.quantidadeRecebida, item.precoUnitario, usuarioId);

        await tx.itemPedidoCompra.update({
          where: { id: item.id },
          data: {
            quantidadeRecebida: { increment: recebido.quantidadeRecebida },
            loteCodigo: recebido.loteCodigo,
            dataValidade: recebido.dataValidade,
          },
        });
      }

      const atualizados = await tx.itemPedidoCompra.findMany({ where: { pedidoCompraId: pedido.id } });
      const completo = atualizados.every((i) => i.quantidadeRecebida >= i.quantidade);

      return tx.pedidoCompra.update({
        where: { id: pedido.id },
        data: { status: completo ? "RECEBIDO" : "RECEBIDO_PARCIAL" },
      });
    },
    { timeout: 20_000 },
  );
}

/**
 * Sugestao de reposicao: produtos cujo saldo esta abaixo do minimo.
 * Quantidade sugerida = estoqueMaximo (ou 2x o minimo) - saldo atual.
 */
export async function sugestaoReposicao() {
  const produtos = await prisma.produto.findMany({
    where: { status: "ATIVO" },
    include: {
      lotes: { select: { quantidade: true } },
      fornecedor: { select: { id: true, razaoSocial: true } },
    },
  });

  return produtos
    .map((p) => {
      const saldo = p.lotes.reduce((s, l) => s + l.quantidade, 0);
      const alvo = p.estoqueMaximo > 0 ? p.estoqueMaximo : p.estoqueMinimo * 2;
      return {
        id: p.id,
        sku: p.sku,
        nome: p.nomeComercial,
        saldo,
        estoqueMinimo: p.estoqueMinimo,
        sugestao: Math.max(0, alvo - saldo),
        custoMedio: p.custoMedio,
        fornecedor: p.fornecedor,
      };
    })
    .filter((p) => p.saldo <= p.estoqueMinimo && p.sugestao > 0)
    .sort((a, b) => a.saldo - b.saldo);
}
