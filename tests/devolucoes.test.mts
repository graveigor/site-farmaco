import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCliente, criarLote, criarProduto, criarUsuario, prepararBanco } from "./apoio.mjs";

prepararBanco("devolucoes");
const { prisma } = await import("../src/lib/db.js");
const { movimentar } = await import("../src/server/estoque.js");
const { saldoTotal } = await import("../src/server/estoque.js");

let usuarioId: string;

before(async () => {
  usuarioId = (await criarUsuario(prisma)).id;
});

after(async () => {
  await prisma.$disconnect();
});

/**
 * Reproduz a regra de conferência de devolução implementada na rota
 * /api/devolucoes/[id]/conferir: só o destino REVENDA recompõe o estoque.
 */
async function conferir(devolucaoId: string, status: "APROVADA" | "REJEITADA", destino: string | null) {
  const devolucao = await prisma.devolucao.findUniqueOrThrow({
    where: { id: devolucaoId },
    include: { itens: true },
  });

  await prisma.$transaction(async (tx) => {
    if (status === "APROVADA" && destino === "REVENDA") {
      for (const item of devolucao.itens) {
        if (!item.loteId) continue;
        await movimentar(tx, {
          produtoId: item.produtoId,
          loteId: item.loteId,
          quantidade: item.quantidade,
          tipo: "DEVOLUCAO",
          origem: "DEVOLUCAO",
          origemId: devolucao.id,
          usuarioId,
        });
      }
    }
    await tx.itemDevolucao.updateMany({
      where: { devolucaoId },
      data: { aprovado: status === "APROVADA" },
    });
    await tx.devolucao.update({
      where: { id: devolucaoId },
      data: { status, destino, conferidoPor: usuarioId, conferidoEm: new Date() },
    });
  });
}

async function criarDevolucao(produtoId: string, loteId: string, quantidade: number) {
  const cliente = await criarCliente(prisma);
  return prisma.devolucao.create({
    data: {
      numero: `DEV-T-${Math.random().toString(36).slice(2, 9)}`,
      clienteId: cliente.id,
      motivo: "AVARIA",
      valorTotal: quantidade * 20,
      itens: { create: [{ produtoId, loteId, quantidade, precoUnitario: 20 }] },
    },
  });
}

describe("conferência de devolução", () => {
  it("devolve o item ao estoque quando o destino é revenda", async () => {
    const produto = await criarProduto(prisma);
    const lote = await criarLote(prisma, produto.id, 100, 300);
    const devolucao = await criarDevolucao(produto.id, lote.id, 5);

    await conferir(devolucao.id, "APROVADA", "REVENDA");

    assert.equal(await saldoTotal(produto.id), 105, "revenda deve recompor o saldo");

    const movimento = await prisma.movimentoEstoque.findFirstOrThrow({
      where: { origemId: devolucao.id },
    });
    assert.equal(movimento.tipo, "DEVOLUCAO");
    assert.equal(movimento.quantidade, 5);
  });

  it("não recompõe o estoque quando o destino é descarte", async () => {
    const produto = await criarProduto(prisma);
    const lote = await criarLote(prisma, produto.id, 100, 300);
    const devolucao = await criarDevolucao(produto.id, lote.id, 5);

    await conferir(devolucao.id, "APROVADA", "DESCARTE");

    assert.equal(await saldoTotal(produto.id), 100, "descarte não volta para o estoque");
  });

  it("não recompõe o estoque quando o destino é quarentena", async () => {
    const produto = await criarProduto(prisma);
    const lote = await criarLote(prisma, produto.id, 100, 300);
    const devolucao = await criarDevolucao(produto.id, lote.id, 5);

    await conferir(devolucao.id, "APROVADA", "QUARENTENA");

    assert.equal(await saldoTotal(produto.id), 100);
  });

  it("não altera estoque quando a devolução é rejeitada", async () => {
    const produto = await criarProduto(prisma);
    const lote = await criarLote(prisma, produto.id, 100, 300);
    const devolucao = await criarDevolucao(produto.id, lote.id, 5);

    await conferir(devolucao.id, "REJEITADA", null);

    assert.equal(await saldoTotal(produto.id), 100);

    const itens = await prisma.itemDevolucao.findMany({ where: { devolucaoId: devolucao.id } });
    assert.equal(itens[0].aprovado, false);
  });
});

describe("movimentação de estoque", () => {
  it("impede que a saída deixe o lote negativo", async () => {
    const produto = await criarProduto(prisma);
    const lote = await criarLote(prisma, produto.id, 10, 300);

    await assert.rejects(
      () =>
        prisma.$transaction((tx) =>
          movimentar(tx, {
            produtoId: produto.id,
            loteId: lote.id,
            quantidade: -11,
            tipo: "SAIDA",
          }),
        ),
      /[Ss]aldo insuficiente/,
    );
  });

  it("registra o saldo resultante em cada movimento (kardex)", async () => {
    const produto = await criarProduto(prisma);
    const lote = await criarLote(prisma, produto.id, 50, 300);

    await prisma.$transaction((tx) =>
      movimentar(tx, { produtoId: produto.id, loteId: lote.id, quantidade: -20, tipo: "SAIDA" }),
    );
    await prisma.$transaction((tx) =>
      movimentar(tx, { produtoId: produto.id, loteId: lote.id, quantidade: 5, tipo: "ENTRADA" }),
    );

    const movimentos = await prisma.movimentoEstoque.findMany({
      where: { produtoId: produto.id },
      orderBy: { criadoEm: "asc" },
    });
    assert.equal(movimentos.at(-2)?.saldoApos, 30);
    assert.equal(movimentos.at(-1)?.saldoApos, 35);
  });
});
