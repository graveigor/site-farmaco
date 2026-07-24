import { prisma } from "@/lib/db";
import { corpo, exigir, ok, regraNegocio, registrarLog, tratarErro } from "@/lib/api";
import { contaPagarSchema, contaReceberSchema } from "@/lib/schemas";

/** Cadastro de títulos. `tipo` = "pagar" | "receber". */
export async function POST(req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  try {
    const sessao = await exigir("financeiro", "CRIAR");
    const { tipo } = await ctx.params;

    if (tipo === "pagar") {
      const dados = await corpo(req, contaPagarSchema);
      const conta = await prisma.contaPagar.create({
        data: { ...dados, fornecedorId: dados.fornecedorId || null, categoriaId: dados.categoriaId || null },
      });
      await registrarLog({ usuarioId: sessao.id, acao: "CRIAR", entidade: "ContaPagar", entidadeId: conta.id });
      return ok(conta, 201);
    }

    if (tipo === "receber") {
      const dados = await corpo(req, contaReceberSchema);
      const conta = await prisma.contaReceber.create({
        data: { ...dados, clienteId: dados.clienteId || null, categoriaId: dados.categoriaId || null },
      });
      await registrarLog({ usuarioId: sessao.id, acao: "CRIAR", entidade: "ContaReceber", entidadeId: conta.id });
      return ok(conta, 201);
    }

    throw regraNegocio("Tipo de título inválido.");
  } catch (erro) {
    return tratarErro(erro);
  }
}
