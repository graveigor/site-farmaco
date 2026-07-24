import { prisma } from "@/lib/db";
import { obterSessao } from "@/lib/auth";
import { naoAutorizado, ok, tratarErro } from "@/lib/api";

/**
 * Marca que a pessoa já viu o tour de boas-vindas.
 *
 * Não passa por `exigir` porque não é uma ação sobre dados de negócio: qualquer
 * usuário autenticado pode encerrar o próprio tour, independente de área ou
 * perfil. Também não entra na trilha de auditoria — seria ruído.
 */
export async function POST() {
  try {
    const sessao = await obterSessao();
    if (!sessao) throw naoAutorizado();

    await prisma.usuario.update({
      where: { id: sessao.id },
      data: { tourVistoEm: new Date() },
    });

    return ok({ concluido: true });
  } catch (erro) {
    return tratarErro(erro);
  }
}

/** Reabre o tour (usado quando a pessoa quer rever a apresentação). */
export async function DELETE() {
  try {
    const sessao = await obterSessao();
    if (!sessao) throw naoAutorizado();

    await prisma.usuario.update({
      where: { id: sessao.id },
      data: { tourVistoEm: null },
    });

    return ok({ reiniciado: true });
  } catch (erro) {
    return tratarErro(erro);
  }
}
