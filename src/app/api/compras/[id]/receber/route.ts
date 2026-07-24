import { corpo, exigir, ok, registrarLog, tratarErro } from "@/lib/api";
import { recebimentoSchema } from "@/lib/schemas";
import { receberMercadoria } from "@/server/compras";

/**
 * Recebimento físico pela Logística: gera lotes com validade, movimenta o
 * estoque e recalcula o custo médio do produto.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const sessao = await exigir("logistica", "EDITAR");
    const { id } = await ctx.params;
    const dados = await corpo(req, recebimentoSchema);

    const pedido = await receberMercadoria(id, dados.itens, sessao.id);

    await registrarLog({
      usuarioId: sessao.id,
      acao: "EDITAR",
      entidade: "PedidoCompra",
      entidadeId: id,
      detalhes: `Recebimento de ${dados.itens.length} item(ns) — status ${pedido.status}`,
    });

    return ok(pedido);
  } catch (erro) {
    return tratarErro(erro);
  }
}
