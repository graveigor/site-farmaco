import { prisma } from "@/lib/db";
import { corpo, exigir, naoEncontrado, ok, registrarLog, regraNegocio, tratarErro } from "@/lib/api";
import { conferenciaSchema, separacaoSchema } from "@/lib/schemas";

/** Registra as quantidades separadas pelo operador de armazém. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const sessao = await exigir("logistica", "EDITAR");
    const { id } = await ctx.params;
    const dados = await corpo(req, separacaoSchema);

    const separacao = await prisma.separacao.findUnique({ where: { id }, include: { itens: true } });
    if (!separacao) throw naoEncontrado("Separação");

    await prisma.$transaction(
      dados.itens.map((i) =>
        prisma.itemSeparacao.update({
          where: { id: i.itemSeparacaoId },
          data: { loteId: i.loteId, quantidadeSeparada: i.quantidadeSeparada },
        }),
      ),
    );

    await prisma.separacao.update({
      where: { id },
      data: { status: "SEPARADO", separadorId: sessao.id, finalizadaEm: new Date() },
    });

    await registrarLog({ usuarioId: sessao.id, acao: "EDITAR", entidade: "Separacao", entidadeId: id, detalhes: "Separação finalizada" });
    return ok({ id });
  } catch (erro) {
    return tratarErro(erro);
  }
}

/** Conferência: confronta o que foi separado com o que foi pedido. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const sessao = await exigir("logistica", "APROVAR");
    const { id } = await ctx.params;
    const dados = await corpo(req, conferenciaSchema);

    const separacao = await prisma.separacao.findUnique({ where: { id }, include: { itens: true } });
    if (!separacao) throw naoEncontrado("Separação");
    if (separacao.status === "CONFERIDO") throw regraNegocio("Esta separação já foi conferida.");

    await prisma.$transaction(
      dados.itens.map((i) =>
        prisma.itemSeparacao.update({
          where: { id: i.itemSeparacaoId },
          data: { quantidadeConferida: i.quantidadeConferida },
        }),
      ),
    );

    const atualizados = await prisma.itemSeparacao.findMany({ where: { separacaoId: id } });
    const divergente = atualizados.some((i) => i.quantidadeConferida !== i.quantidadeSolicitada);

    await prisma.separacao.update({
      where: { id },
      data: {
        status: divergente ? "DIVERGENTE" : "CONFERIDO",
        conferenteId: sessao.id,
        conferidaEm: new Date(),
        observacoes: dados.observacoes,
      },
    });

    await registrarLog({
      usuarioId: sessao.id,
      acao: "APROVAR",
      entidade: "Separacao",
      entidadeId: id,
      detalhes: divergente ? "Conferência com divergência" : "Conferência OK",
    });

    return ok({ id, divergente });
  } catch (erro) {
    return tratarErro(erro);
  }
}
