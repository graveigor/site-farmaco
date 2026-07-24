import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarFornecedor, criarLote, criarProduto, criarUsuario, emDias, prepararBanco } from "./apoio.mjs";

prepararBanco("compras");
const { prisma } = await import("../src/lib/db.js");
const { receberMercadoria, transicionarCompra, sugestaoReposicao } = await import("../src/server/compras.js");
const { saldoTotal } = await import("../src/server/estoque.js");

let usuarioId: string;

before(async () => {
  usuarioId = (await criarUsuario(prisma)).id;
});

after(async () => {
  await prisma.$disconnect();
});

/** Cria uma compra em AGUARDANDO_APROVACAO com um item. */
async function criarCompra(produtoId: string, quantidade: number, precoUnitario: number) {
  const fornecedor = await criarFornecedor(prisma);
  return prisma.pedidoCompra.create({
    data: {
      numero: `PC-T-${Math.random().toString(36).slice(2, 9)}`,
      fornecedorId: fornecedor.id,
      status: "AGUARDANDO_APROVACAO",
      valorTotal: quantidade * precoUnitario,
      itens: { create: [{ produtoId, quantidade, precoUnitario }] },
    },
    include: { itens: true },
  });
}

describe("fluxo de compra", () => {
  it("gera contas a pagar na aprovação", async () => {
    const produto = await criarProduto(prisma);
    const compra = await criarCompra(produto.id, 100, 12);

    await transicionarCompra(compra.id, "APROVADO", usuarioId);

    const conta = await prisma.contaPagar.findFirstOrThrow({ where: { pedidoCompraId: compra.id } });
    assert.equal(conta.valor, 1200);
    assert.equal(conta.status, "ABERTA");

    const atualizada = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: compra.id } });
    assert.equal(atualizada.status, "APROVADO");
    assert.equal(atualizada.aprovadorId, usuarioId);
  });

  it("cancela o título a pagar quando a compra é rejeitada", async () => {
    const produto = await criarProduto(prisma);
    const compra = await criarCompra(produto.id, 10, 5);

    await transicionarCompra(compra.id, "REJEITADO", usuarioId);

    const contas = await prisma.contaPagar.findMany({ where: { pedidoCompraId: compra.id } });
    assert.equal(contas.length, 0, "rejeitar antes de aprovar não deve deixar título");
  });

  it("recebe mercadoria criando lote, movimentando estoque e recalculando o custo", async () => {
    const produto = await criarProduto(prisma, { custoMedio: 10 });
    await criarLote(prisma, produto.id, 100, 300); // saldo inicial a R$ 10
    const compra = await criarCompra(produto.id, 100, 20); // entrada a R$ 20

    await transicionarCompra(compra.id, "APROVADO", usuarioId);
    await receberMercadoria(
      compra.id,
      [
        {
          itemId: compra.itens[0].id,
          quantidadeRecebida: 100,
          loteCodigo: "LOTE-NOVO",
          dataValidade: emDias(400),
          localizacao: "RUA-A",
        },
      ],
      usuarioId,
    );

    assert.equal(await saldoTotal(produto.id), 200, "saldo deve somar a entrada");

    const lote = await prisma.lote.findFirstOrThrow({ where: { produtoId: produto.id, codigo: "LOTE-NOVO" } });
    assert.equal(lote.quantidade, 100);
    assert.equal(lote.localizacao, "RUA-A");

    // (100 × 10 + 100 × 20) / 200 = 15
    const atualizado = await prisma.produto.findUniqueOrThrow({ where: { id: produto.id } });
    assert.equal(atualizado.custoMedio, 15);

    const final = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: compra.id } });
    assert.equal(final.status, "RECEBIDO");
  });

  it("marca como recebimento parcial quando falta item", async () => {
    const produto = await criarProduto(prisma);
    const compra = await criarCompra(produto.id, 100, 10);
    await transicionarCompra(compra.id, "APROVADO", usuarioId);

    await receberMercadoria(
      compra.id,
      [{ itemId: compra.itens[0].id, quantidadeRecebida: 40, loteCodigo: "PARCIAL", dataValidade: emDias(300) }],
      usuarioId,
    );

    const parcial = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: compra.id } });
    assert.equal(parcial.status, "RECEBIDO_PARCIAL");

    // Recebe o restante: deve fechar como RECEBIDO e somar no mesmo lote.
    await receberMercadoria(
      compra.id,
      [{ itemId: compra.itens[0].id, quantidadeRecebida: 60, loteCodigo: "PARCIAL", dataValidade: emDias(300) }],
      usuarioId,
    );

    const completa = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: compra.id } });
    assert.equal(completa.status, "RECEBIDO");

    const lote = await prisma.lote.findFirstOrThrow({ where: { produtoId: produto.id, codigo: "PARCIAL" } });
    assert.equal(lote.quantidade, 100, "recebimentos do mesmo lote devem somar");
  });

  it("recusa lote vencido no recebimento", async () => {
    const produto = await criarProduto(prisma);
    const compra = await criarCompra(produto.id, 10, 10);
    await transicionarCompra(compra.id, "APROVADO", usuarioId);

    await assert.rejects(
      () =>
        receberMercadoria(
          compra.id,
          [{ itemId: compra.itens[0].id, quantidadeRecebida: 10, loteCodigo: "VELHO", dataValidade: emDias(-1) }],
          usuarioId,
        ),
      /vencido/i,
    );
  });

  it("recusa receber mais do que foi pedido", async () => {
    const produto = await criarProduto(prisma);
    const compra = await criarCompra(produto.id, 10, 10);
    await transicionarCompra(compra.id, "APROVADO", usuarioId);

    await assert.rejects(
      () =>
        receberMercadoria(
          compra.id,
          [{ itemId: compra.itens[0].id, quantidadeRecebida: 11, loteCodigo: "X", dataValidade: emDias(300) }],
          usuarioId,
        ),
      /maior que a pendente/i,
    );
  });

  it("impede recebimento de compra não aprovada", async () => {
    const produto = await criarProduto(prisma);
    const compra = await criarCompra(produto.id, 10, 10); // segue AGUARDANDO_APROVACAO

    await assert.rejects(
      () =>
        receberMercadoria(
          compra.id,
          [{ itemId: compra.itens[0].id, quantidadeRecebida: 10, loteCodigo: "X", dataValidade: emDias(300) }],
          usuarioId,
        ),
      /aprovados/i,
    );
  });
});

describe("sugestão de reposição", () => {
  it("lista apenas produtos no ou abaixo do mínimo, com a quantidade para atingir o máximo", async () => {
    await prisma.movimentoEstoque.deleteMany();
    await prisma.itemPedidoCompra.deleteMany();
    await prisma.lote.deleteMany();
    await prisma.produto.deleteMany();

    const repor = await prisma.produto.create({
      data: { sku: "REPOR", nomeComercial: "Precisa repor", estoqueMinimo: 100, estoqueMaximo: 500 },
    });
    await criarLote(prisma, repor.id, 20, 300);

    const ok = await prisma.produto.create({
      data: { sku: "OK", nomeComercial: "Estoque saudável", estoqueMinimo: 10, estoqueMaximo: 100 },
    });
    await criarLote(prisma, ok.id, 90, 300);

    const sugestoes = await sugestaoReposicao();

    assert.equal(sugestoes.length, 1, "só o produto abaixo do mínimo deve aparecer");
    assert.equal(sugestoes[0].id, repor.id);
    assert.equal(sugestoes[0].sugestao, 480, "máximo 500 − saldo 20");
  });
});
