import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCliente, criarFornecedor, emDias, prepararBanco } from "./apoio.mjs";

prepararBanco("financeiro");
const { prisma } = await import("../src/lib/db.js");
const { darBaixa, inadimplencia, saldoEmAberto } = await import("../src/server/financeiro.js");

after(async () => {
  await prisma.$disconnect();
});

async function tituloReceber(valor: number, vencimentoEmDias = 30) {
  const cliente = await criarCliente(prisma);
  return prisma.contaReceber.create({
    data: { descricao: "Título de teste", clienteId: cliente.id, valor, vencimento: emDias(vencimentoEmDias) },
  });
}

async function tituloPagar(valor: number, vencimentoEmDias = 30) {
  const fornecedor = await criarFornecedor(prisma);
  return prisma.contaPagar.create({
    data: { descricao: "Título de teste", fornecedorId: fornecedor.id, valor, vencimento: emDias(vencimentoEmDias) },
  });
}

describe("baixa de contas a receber", () => {
  it("quita o título quando o valor total é baixado", async () => {
    const titulo = await tituloReceber(500);
    const r = await darBaixa("receber", titulo.id, 500);

    assert.equal(r.status, "RECEBIDA");
    assert.equal(r.valorRecebido, 500);
    assert.ok(r.recebimentoEm, "deve registrar a data de recebimento");
  });

  it("marca como parcial e acumula em baixas sucessivas", async () => {
    const titulo = await tituloReceber(1000);

    const primeira = await darBaixa("receber", titulo.id, 300);
    assert.equal(primeira.status, "PARCIAL");
    assert.equal(primeira.valorRecebido, 300);
    assert.equal(primeira.recebimentoEm, null, "parcial não fecha a data");

    const segunda = await darBaixa("receber", titulo.id, 700);
    assert.equal(segunda.status, "RECEBIDA");
    assert.equal(segunda.valorRecebido, 1000);
  });

  it("recusa baixa acima do saldo do título", async () => {
    const titulo = await tituloReceber(100);
    await assert.rejects(() => darBaixa("receber", titulo.id, 150), /excede o saldo/);
  });

  it("recusa baixa acima do saldo já parcialmente quitado", async () => {
    const titulo = await tituloReceber(100);
    await darBaixa("receber", titulo.id, 60);
    await assert.rejects(() => darBaixa("receber", titulo.id, 50), /excede o saldo/);
  });

  it("recusa valor zero ou negativo", async () => {
    const titulo = await tituloReceber(100);
    await assert.rejects(() => darBaixa("receber", titulo.id, 0), /maior que zero/);
    await assert.rejects(() => darBaixa("receber", titulo.id, -10), /maior que zero/);
  });

  it("recusa baixa em título cancelado", async () => {
    const titulo = await tituloReceber(100);
    await prisma.contaReceber.update({ where: { id: titulo.id }, data: { status: "CANCELADA" } });
    await assert.rejects(() => darBaixa("receber", titulo.id, 100), /cancelado/i);
  });

  it("quita corretamente valores com centavos, apesar do ponto flutuante", async () => {
    // 0.1 + 0.2 !== 0.3 em ponto flutuante: a tolerância deve cobrir isso.
    const titulo = await tituloReceber(0.3);
    await darBaixa("receber", titulo.id, 0.1);
    const r = await darBaixa("receber", titulo.id, 0.2);

    assert.equal(r.status, "RECEBIDA", "somatório com centavos deve fechar o título");
  });

  it("gera entrada no fluxo de caixa", async () => {
    const titulo = await tituloReceber(250);
    await darBaixa("receber", titulo.id, 250);

    const movimento = await prisma.movimentoCaixa.findFirstOrThrow({ where: { origemId: titulo.id } });
    assert.equal(movimento.tipo, "ENTRADA");
    assert.equal(movimento.valor, 250);
  });
});

describe("baixa de contas a pagar", () => {
  it("quita e gera saída no fluxo de caixa", async () => {
    const titulo = await tituloPagar(800);
    const r = await darBaixa("pagar", titulo.id, 800);

    assert.equal(r.status, "PAGA");
    assert.ok(r.pagamentoEm);

    const movimento = await prisma.movimentoCaixa.findFirstOrThrow({ where: { origemId: titulo.id } });
    assert.equal(movimento.tipo, "SAIDA");
    assert.equal(movimento.valor, 800);
  });

  it("suporta pagamento parcial", async () => {
    const titulo = await tituloPagar(600);
    const r = await darBaixa("pagar", titulo.id, 200);

    assert.equal(r.status, "PARCIAL");
    assert.equal(r.valorPago, 200);
  });
});

describe("indicadores financeiros", () => {
  it("soma apenas o saldo não quitado", async () => {
    await prisma.movimentoCaixa.deleteMany();
    await prisma.contaReceber.deleteMany();

    const aberto = await tituloReceber(1000);
    const parcial = await tituloReceber(500);
    const quitado = await tituloReceber(300);

    await darBaixa("receber", parcial.id, 200); // restam 300
    await darBaixa("receber", quitado.id, 300); // sai da conta

    // 1000 (aberto) + 300 (restante do parcial) = 1300
    assert.equal(await saldoEmAberto("receber"), 1300);
    assert.ok(aberto.id);
  });

  it("considera inadimplente apenas o vencido e não quitado", async () => {
    await prisma.movimentoCaixa.deleteMany();
    await prisma.contaReceber.deleteMany();

    await tituloReceber(400, -10); // vencido há 10 dias
    await tituloReceber(700, 15); // ainda a vencer
    const vencidoQuitado = await tituloReceber(900, -20);
    await darBaixa("receber", vencidoQuitado.id, 900); // vencido, porém pago

    const r = await inadimplencia();
    assert.equal(r.quantidade, 1, "só um título vencido em aberto");
    assert.equal(r.total, 400);
  });
});
