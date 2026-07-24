import { corpo, exigir, ok, regraNegocio, registrarLog, tratarErro } from "@/lib/api";
import { baixaSchema } from "@/lib/schemas";
import { darBaixa } from "@/server/financeiro";

/**
 * Baixa (pagamento ou recebimento) de um título. A regra de negócio vive em
 * `src/server/financeiro.ts` — aqui ficam apenas permissão, validação de
 * entrada e auditoria.
 */
export async function POST(req: Request, ctx: { params: Promise<{ tipo: string; id: string }> }) {
  try {
    const sessao = await exigir("financeiro", "EDITAR");
    const { tipo, id } = await ctx.params;

    if (tipo !== "pagar" && tipo !== "receber") throw regraNegocio("Tipo de título inválido.");

    const dados = await corpo(req, baixaSchema);
    const conta = await darBaixa(tipo, id, dados.valor, dados.data ?? new Date());

    await registrarLog({
      usuarioId: sessao.id,
      acao: "EDITAR",
      entidade: tipo === "pagar" ? "ContaPagar" : "ContaReceber",
      entidadeId: id,
      detalhes: `Baixa de ${dados.valor.toFixed(2)} — situação ${conta.status}`,
    });

    return ok(conta);
  } catch (erro) {
    return tratarErro(erro);
  }
}
