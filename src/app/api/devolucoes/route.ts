import { prisma } from "@/lib/db";
import { corpo, exigir, ok, registrarLog, tratarErro } from "@/lib/api";
import { devolucaoSchema } from "@/lib/schemas";
import { proximoNumero } from "@/lib/utils";

export async function GET() {
  try {
    await exigir("devolucoes", "VER");
    const devolucoes = await prisma.devolucao.findMany({
      include: { cliente: true, itens: { include: { produto: true } } },
      orderBy: { criadoEm: "desc" },
    });
    return ok(devolucoes);
  } catch (erro) {
    return tratarErro(erro);
  }
}

export async function POST(req: Request) {
  try {
    const sessao = await exigir("devolucoes", "CRIAR");
    const dados = await corpo(req, devolucaoSchema);

    const ultimo = await prisma.devolucao.findFirst({ orderBy: { numero: "desc" }, select: { numero: true } });
    const valorTotal = dados.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);

    const devolucao = await prisma.devolucao.create({
      data: {
        numero: proximoNumero("DEV", ultimo?.numero),
        clienteId: dados.clienteId,
        pedidoVendaId: dados.pedidoVendaId || null,
        tipo: dados.tipo,
        motivo: dados.motivo,
        descricao: dados.descricao,
        valorTotal,
        itens: { create: dados.itens.map((i) => ({ ...i, loteId: i.loteId || null })) },
      },
    });

    await registrarLog({
      usuarioId: sessao.id,
      acao: "CRIAR",
      entidade: "Devolucao",
      entidadeId: devolucao.id,
      detalhes: `${dados.tipo} ${devolucao.numero} — motivo ${dados.motivo}`,
    });

    return ok(devolucao, 201);
  } catch (erro) {
    return tratarErro(erro);
  }
}
