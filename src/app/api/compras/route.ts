import { prisma } from "@/lib/db";
import { corpo, exigir, ok, registrarLog, tratarErro } from "@/lib/api";
import { pedidoCompraSchema } from "@/lib/schemas";
import { gerarNumeroPedidoCompra } from "@/server/compras";

export async function GET() {
  try {
    await exigir("compras", "VER");
    const pedidos = await prisma.pedidoCompra.findMany({
      include: { fornecedor: true, itens: { include: { produto: true } } },
      orderBy: { criadoEm: "desc" },
    });
    return ok(pedidos);
  } catch (erro) {
    return tratarErro(erro);
  }
}

export async function POST(req: Request) {
  try {
    const sessao = await exigir("compras", "CRIAR");
    const dados = await corpo(req, pedidoCompraSchema);

    const valorTotal = dados.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);

    const pedido = await prisma.pedidoCompra.create({
      data: {
        numero: await gerarNumeroPedidoCompra(),
        fornecedorId: dados.fornecedorId,
        compradorId: sessao.id,
        previsaoEntrega: dados.previsaoEntrega,
        observacoes: dados.observacoes,
        status: "AGUARDANDO_APROVACAO",
        valorTotal,
        itens: { create: dados.itens },
      },
    });

    await registrarLog({
      usuarioId: sessao.id,
      acao: "CRIAR",
      entidade: "PedidoCompra",
      entidadeId: pedido.id,
      detalhes: `Compra ${pedido.numero} — total ${valorTotal.toFixed(2)}`,
    });

    return ok(pedido, 201);
  } catch (erro) {
    return tratarErro(erro);
  }
}
