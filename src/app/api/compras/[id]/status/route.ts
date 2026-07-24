import { corpo, exigir, ok, registrarLog, tratarErro } from "@/lib/api";
import { transicaoSchema } from "@/lib/schemas";
import { transicionarCompra } from "@/server/compras";
import type { StatusPedidoCompra } from "@/lib/constants";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const dados = await corpo(req, transicaoSchema);
    const status = dados.status as StatusPedidoCompra;

    // Aprovar/rejeitar compromete verba: exige permissão de aprovação.
    const decisao = ["APROVADO", "REJEITADO", "CANCELADO"].includes(status);
    const sessao = await exigir("compras", decisao ? "APROVAR" : "EDITAR");

    const pedido = await transicionarCompra(id, status, sessao.id);

    await registrarLog({
      usuarioId: sessao.id,
      acao: decisao ? "APROVAR" : "EDITAR",
      entidade: "PedidoCompra",
      entidadeId: id,
      detalhes: `Status alterado para ${status}`,
    });

    return ok(pedido);
  } catch (erro) {
    return tratarErro(erro);
  }
}
