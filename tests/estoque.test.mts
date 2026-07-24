import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarLote, criarProduto, prepararBanco } from "./apoio.mjs";

prepararBanco("estoque");
const { prisma } = await import("../src/lib/db.js");
const { disponivelPorProduto, sugerirLotesFEFO, alertasEstoque, atualizarCustoMedio } = await import(
  "../src/server/estoque.js"
);

after(async () => {
  await prisma.$disconnect();
});

describe("seleção de lotes por FEFO", () => {
  it("consome primeiro o lote que vence antes", async () => {
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 50, 300, "TARDE");
    await criarLote(prisma, produto.id, 30, 30, "CEDO");

    const alocacao = await sugerirLotesFEFO(produto.id, 20);
    assert.equal(alocacao.length, 1);
    assert.equal(alocacao[0].codigo, "CEDO", "deve puxar o lote de validade mais próxima");
    assert.equal(alocacao[0].quantidade, 20);
  });

  it("divide entre lotes quando um só não atende, respeitando a ordem de validade", async () => {
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 30, 30, "CEDO");
    await criarLote(prisma, produto.id, 50, 300, "TARDE");

    const alocacao = await sugerirLotesFEFO(produto.id, 45);
    assert.equal(alocacao.length, 2);
    assert.deepEqual(
      alocacao.map((a) => [a.codigo, a.quantidade]),
      [
        ["CEDO", 30],
        ["TARDE", 15],
      ],
    );
  });

  it("ignora lotes vencidos ao calcular disponibilidade", async () => {
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 40, -10, "VENCIDO");
    await criarLote(prisma, produto.id, 25, 200, "VALIDO");

    assert.equal(await disponivelPorProduto(produto.id), 25, "lote vencido não conta como disponível");
    await assert.rejects(() => sugerirLotesFEFO(produto.id, 30), /[Ee]stoque insuficiente/);
  });

  it("ignora lotes bloqueados", async () => {
    const produto = await criarProduto(prisma);
    const lote = await criarLote(prisma, produto.id, 60, 200);
    await prisma.lote.update({ where: { id: lote.id }, data: { bloqueado: true } });

    assert.equal(await disponivelPorProduto(produto.id), 0);
  });

  it("desconta o que já está reservado", async () => {
    const produto = await criarProduto(prisma);
    const lote = await criarLote(prisma, produto.id, 100, 200);
    await prisma.lote.update({ where: { id: lote.id }, data: { quantidadeReservada: 40 } });

    assert.equal(await disponivelPorProduto(produto.id), 60);
  });

  it("recusa alocação maior que o saldo disponível", async () => {
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 10, 200);

    await assert.rejects(() => sugerirLotesFEFO(produto.id, 11), /faltam 1 unidade/);
  });
});

describe("custo médio ponderado", () => {
  it("pondera a entrada nova contra o saldo existente", async () => {
    // 100 un a R$ 10 + 100 un a R$ 20 => custo médio R$ 15.
    const produto = await criarProduto(prisma, { custoMedio: 10 });
    await criarLote(prisma, produto.id, 200, 300); // saldo já inclui a entrada

    await prisma.$transaction(async (tx) => {
      await atualizarCustoMedio(tx, produto.id, 100, 20);
    });

    const atualizado = await prisma.produto.findUniqueOrThrow({ where: { id: produto.id } });
    assert.equal(atualizado.custoMedio, 15);
  });

  it("registra a alteração no histórico de preços", async () => {
    const produto = await criarProduto(prisma, { custoMedio: 10 });
    await criarLote(prisma, produto.id, 200, 300);

    await prisma.$transaction(async (tx) => {
      await atualizarCustoMedio(tx, produto.id, 100, 20);
    });

    const historico = await prisma.historicoPreco.findFirstOrThrow({ where: { produtoId: produto.id } });
    assert.equal(historico.tipo, "CUSTO");
    assert.equal(historico.valorAnterior, 10);
    assert.equal(historico.valorNovo, 15);
  });

  it("não registra histórico quando o custo não muda de fato", async () => {
    const produto = await criarProduto(prisma, { custoMedio: 10 });
    await criarLote(prisma, produto.id, 200, 300);

    await prisma.$transaction(async (tx) => {
      await atualizarCustoMedio(tx, produto.id, 100, 10); // mesmo custo
    });

    const qtd = await prisma.historicoPreco.count({ where: { produtoId: produto.id } });
    assert.equal(qtd, 0);
  });
});

describe("alertas de estoque", () => {
  it("classifica lotes vencidos, a vencer e produtos abaixo do mínimo", async () => {
    // Banco isolado por teste seria ideal; aqui limpamos o que já existe.
    await prisma.movimentoEstoque.deleteMany();
    await prisma.lote.deleteMany();
    await prisma.produto.deleteMany();

    const vencido = await criarProduto(prisma, { estoqueMinimo: 5 });
    await criarLote(prisma, vencido.id, 10, -5);

    const aVencer = await criarProduto(prisma, { estoqueMinimo: 5 });
    await criarLote(prisma, aVencer.id, 10, 20);

    const baixo = await criarProduto(prisma, { estoqueMinimo: 100 });
    await criarLote(prisma, baixo.id, 10, 300);

    const zerado = await criarProduto(prisma, { estoqueMinimo: 10 });
    await criarLote(prisma, zerado.id, 0, 300);

    const alertas = await alertasEstoque();

    assert.equal(alertas.vencidos.length, 1, "um lote vencido");
    assert.equal(alertas.aVencer.length, 1, "um lote dentro da janela de 90 dias");
    assert.ok(
      alertas.estoqueBaixo.some((p) => p.id === baixo.id),
      "produto com saldo abaixo do mínimo deve entrar em estoque baixo",
    );
    assert.ok(
      alertas.estoqueZerado.some((p) => p.id === zerado.id),
      "produto sem saldo deve entrar em estoque zerado",
    );
  });
});
