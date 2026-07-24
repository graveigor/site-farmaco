import { prisma } from "@/lib/db";
import { corpo, exigir, ok, registrarLog, tratarErro } from "@/lib/api";
import { pedidoVendaSchema } from "@/lib/schemas";
import { gerarNumeroPedidoVenda } from "@/server/pedidos";

export async function GET() {
  try {
    await exigir("pedidos", "VER");
    const pedidos = await prisma.pedidoVenda.findMany({
      include: { cliente: { select: { razaoSocial: true } }, itens: true },
      orderBy: { criadoEm: "desc" },
    });
    return ok(pedidos);
  } catch (erro) {
    return tratarErro(erro);
  }
}

export async function POST(req: Request) {
  try {
    const sessao = await exigir("pedidos", "CRIAR");
    const dados = await corpo(req, pedidoVendaSchema);

    // Preços e totais são recalculados no servidor — o cliente não define valor.
    const produtos = await prisma.produto.findMany({
      where: { id: { in: dados.itens.map((i) => i.produtoId) } },
    });

    const itens = dados.itens.map((item) => {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) throw new Error("Produto inválido no pedido.");
      const total = item.quantidade * item.precoUnitario - item.desconto;
      return { ...item, total };
    });

    const subtotal = itens.reduce((s, i) => s + i.total, 0);
    const valorTotal = Math.max(0, subtotal - dados.desconto);

    const pedido = await prisma.pedidoVenda.create({
      data: {
        numero: await gerarNumeroPedidoVenda(),
        clienteId: dados.clienteId,
        vendedorId: sessao.id,
        condicaoPagamento: dados.condicaoPagamento,
        prazoDias: dados.prazoDias,
        desconto: dados.desconto,
        observacoes: dados.observacoes,
        subtotal,
        valorTotal,
        itens: { create: itens },
      },
    });

    await registrarLog({
      usuarioId: sessao.id,
      acao: "CRIAR",
      entidade: "PedidoVenda",
      entidadeId: pedido.id,
      detalhes: `Pedido ${pedido.numero} — ${itens.length} item(ns), total ${valorTotal.toFixed(2)}`,
    });

    return ok(pedido, 201);
  } catch (erro) {
    return tratarErro(erro);
  }
}
