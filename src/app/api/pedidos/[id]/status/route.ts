import { corpo, exigir, ok, registrarLog, tratarErro } from "@/lib/api";
import { transicaoSchema } from "@/lib/schemas";
import { transicionar } from "@/server/pedidos";
import type { StatusPedidoVenda } from "@/lib/constants";

/**
 * Avança o pedido no fluxo operacional. Etapas que representam decisão
 * (aprovação e cancelamento) exigem a permissão APROVAR; as demais são
 * operacionais e exigem EDITAR.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const dados = await corpo(req, transicaoSchema);
    const status = dados.status as StatusPedidoVenda;

    const exigeAprovacao = status === "APROVADO" || status === "CANCELADO";
    // Etapas de armazém pertencem à Logística; faturamento e aprovação ao Comercial.
    const modulo = ["EM_SEPARACAO", "CONFERIDO", "EXPEDIDO", "EM_TRANSPORTE", "ENTREGUE"].includes(status)
      ? "logistica"
      : "pedidos";

    const sessao = await exigir(modulo, exigeAprovacao ? "APROVAR" : "EDITAR");
    const pedido = await transicionar(id, status, sessao.id, dados.observacoes);

    await registrarLog({
      usuarioId: sessao.id,
      acao: exigeAprovacao ? "APROVAR" : "EDITAR",
      entidade: "PedidoVenda",
      entidadeId: id,
      detalhes: `Status alterado para ${status}`,
    });

    return ok(pedido);
  } catch (erro) {
    return tratarErro(erro);
  }
}
