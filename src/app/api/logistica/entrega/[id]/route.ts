import { prisma } from "@/lib/db";
import { corpo, exigir, ok, registrarLog, tratarErro } from "@/lib/api";
import { entregaSchema } from "@/lib/schemas";

/** Atualiza os dados de transporte e rastreio da entrega. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const sessao = await exigir("logistica", "EDITAR");
    const { id } = await ctx.params;
    const dados = await corpo(req, entregaSchema);

    const entrega = await prisma.entrega.update({ where: { id }, data: dados });

    await registrarLog({ usuarioId: sessao.id, acao: "EDITAR", entidade: "Entrega", entidadeId: id });
    return ok(entrega);
  } catch (erro) {
    return tratarErro(erro);
  }
}
