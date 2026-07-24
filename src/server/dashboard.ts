import { prisma } from "@/lib/db";
import { alertasEstoque } from "./estoque";

/** Consolida os indicadores exibidos no dashboard principal. */
export async function indicadores() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

  const [
    faturamentoMes,
    faturamentoAnterior,
    pedidosPorStatus,
    aReceber,
    aPagar,
    vencidasReceber,
    comprasPendentes,
    devolucoesAbertas,
    garantias,
    estoque,
    topProdutos,
    faturamentoSerie,
  ] = await Promise.all([
    prisma.pedidoVenda.aggregate({
      where: { faturadoEm: { gte: inicioMes }, status: { not: "CANCELADO" } },
      _sum: { valorTotal: true },
      _count: true,
    }),
    prisma.pedidoVenda.aggregate({
      where: { faturadoEm: { gte: inicioMesAnterior, lt: inicioMes }, status: { not: "CANCELADO" } },
      _sum: { valorTotal: true },
    }),
    prisma.pedidoVenda.groupBy({ by: ["status"], _count: { _all: true }, _sum: { valorTotal: true } }),
    prisma.contaReceber.aggregate({
      where: { status: { in: ["ABERTA", "PARCIAL", "VENCIDA"] } },
      _sum: { valor: true, valorRecebido: true },
    }),
    prisma.contaPagar.aggregate({
      where: { status: { in: ["ABERTA", "PARCIAL", "VENCIDA"] } },
      _sum: { valor: true, valorPago: true },
    }),
    prisma.contaReceber.aggregate({
      where: { status: { in: ["ABERTA", "PARCIAL"] }, vencimento: { lt: hoje } },
      _sum: { valor: true, valorRecebido: true },
      _count: true,
    }),
    prisma.pedidoCompra.count({ where: { status: { in: ["AGUARDANDO_APROVACAO", "APROVADO"] } } }),
    prisma.devolucao.count({ where: { tipo: "DEVOLUCAO", status: { in: ["SOLICITADA", "EM_CONFERENCIA"] } } }),
    prisma.devolucao.count({ where: { tipo: "GARANTIA", status: { notIn: ["FINALIZADA", "REJEITADA"] } } }),
    alertasEstoque(),
    prisma.itemPedidoVenda.groupBy({
      by: ["produtoId"],
      _sum: { total: true, quantidade: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    serieFaturamento(6),
  ]);

  const contar = (status: string) => pedidosPorStatus.find((p) => p.status === status)?._count._all ?? 0;

  const produtosTop = await prisma.produto.findMany({
    where: { id: { in: topProdutos.map((t) => t.produtoId) } },
    select: { id: true, nomeComercial: true, sku: true },
  });

  const receita = faturamentoMes._sum.valorTotal ?? 0;
  const receitaAnterior = faturamentoAnterior._sum.valorTotal ?? 0;

  return {
    faturamento: {
      mes: receita,
      anterior: receitaAnterior,
      variacao: receitaAnterior > 0 ? ((receita - receitaAnterior) / receitaAnterior) * 100 : 0,
      pedidos: faturamentoMes._count,
    },
    pedidos: {
      pendentes: contar("AGUARDANDO_APROVACAO") + contar("RASCUNHO"),
      aprovados: contar("APROVADO"),
      emSeparacao: contar("EM_SEPARACAO") + contar("CONFERIDO"),
      faturados: contar("FATURADO"),
      enviados: contar("EXPEDIDO") + contar("EM_TRANSPORTE"),
      entregues: contar("ENTREGUE"),
    },
    financeiro: {
      aReceber: (aReceber._sum.valor ?? 0) - (aReceber._sum.valorRecebido ?? 0),
      aPagar: (aPagar._sum.valor ?? 0) - (aPagar._sum.valorPago ?? 0),
      inadimplencia: (vencidasReceber._sum.valor ?? 0) - (vencidasReceber._sum.valorRecebido ?? 0),
      titulosVencidos: vencidasReceber._count,
    },
    operacao: {
      comprasPendentes,
      devolucoesAbertas,
      garantias,
    },
    estoque: {
      vencidos: estoque.vencidos.length,
      aVencer: estoque.aVencer.length,
      estoqueBaixo: estoque.estoqueBaixo.length,
      estoqueZerado: estoque.estoqueZerado.length,
      listaVencidos: estoque.vencidos.slice(0, 8),
      listaAVencer: estoque.aVencer.slice(0, 8),
      listaBaixo: estoque.estoqueBaixo.slice(0, 8),
    },
    topProdutos: topProdutos.map((t) => ({
      ...produtosTop.find((p) => p.id === t.produtoId),
      total: t._sum.total ?? 0,
      quantidade: t._sum.quantidade ?? 0,
    })),
    serieFaturamento: faturamentoSerie,
  };
}

/** Faturamento dos ultimos N meses, para o grafico do dashboard. */
async function serieFaturamento(meses: number) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);

  const pedidos = await prisma.pedidoVenda.findMany({
    where: { faturadoEm: { gte: inicio }, status: { not: "CANCELADO" } },
    select: { faturadoEm: true, valorTotal: true },
  });

  const buckets: { rotulo: string; valor: number }[] = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1 - i), 1);
    buckets.push({
      rotulo: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      valor: 0,
    });
  }

  for (const p of pedidos) {
    if (!p.faturadoEm) continue;
    const idx =
      (p.faturadoEm.getFullYear() - inicio.getFullYear()) * 12 + (p.faturadoEm.getMonth() - inicio.getMonth());
    if (idx >= 0 && idx < buckets.length) buckets[idx].valor += p.valorTotal;
  }

  return buckets;
}
