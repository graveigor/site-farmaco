import { prisma } from "@/lib/db";
import { corpo, exigir, naoEncontrado, ok, regraNegocio, registrarLog, tratarErro } from "@/lib/api";
import { conferenciaDevolucaoSchema } from "@/lib/schemas";
import { movimentar } from "@/server/estoque";

/**
 * Conferência da devolução. Quando aprovada com destino REVENDA, o produto
 * retorna ao estoque no lote original; nos demais destinos (descarte,
 * quarentena, retorno ao fornecedor) o item não volta ao saldo disponível.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const sessao = await exigir("devolucoes", "APROVAR");
    const { id } = await ctx.params;
    const dados = await corpo(req, conferenciaDevolucaoSchema);

    const devolucao = await prisma.devolucao.findUnique({ where: { id }, include: { itens: true } });
    if (!devolucao) throw naoEncontrado("Devolução");
    if (["APROVADA", "REJEITADA", "FINALIZADA"].includes(devolucao.status)) {
      throw regraNegocio("Esta devolução já foi conferida.");
    }
    if (dados.status === "APROVADA" && !dados.destino) {
      throw regraNegocio("Informe o destino do produto devolvido.");
    }

    await prisma.$transaction(async (tx) => {
      if (dados.status === "APROVADA" && dados.destino === "REVENDA") {
        for (const item of devolucao.itens) {
          if (!item.loteId) continue;
          await movimentar(tx, {
            produtoId: item.produtoId,
            loteId: item.loteId,
            quantidade: item.quantidade,
            tipo: "DEVOLUCAO",
            origem: "DEVOLUCAO",
            origemId: devolucao.id,
            motivo: `Retorno ao estoque — devolução ${devolucao.numero}`,
            usuarioId: sessao.id,
          });
        }
      }

      await tx.itemDevolucao.updateMany({
        where: { devolucaoId: id },
        data: { aprovado: dados.status === "APROVADA" },
      });

      await tx.devolucao.update({
        where: { id },
        data: {
          status: dados.status,
          destino: dados.destino ?? null,
          descricao: dados.descricao ?? devolucao.descricao,
          conferidoPor: sessao.id,
          conferidoEm: new Date(),
        },
      });
    });

    await registrarLog({
      usuarioId: sessao.id,
      acao: "APROVAR",
      entidade: "Devolucao",
      entidadeId: id,
      detalhes: `${dados.status}${dados.destino ? ` — destino ${dados.destino}` : ""}`,
    });

    return ok({ id });
  } catch (erro) {
    return tratarErro(erro);
  }
}
