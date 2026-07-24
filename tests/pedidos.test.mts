import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  conferirTudo,
  criarCliente,
  criarLote,
  criarPedido,
  criarProduto,
  criarUsuario,
  prepararBanco,
} from "./apoio.mjs";

// O banco precisa existir antes de importar os módulos que usam o Prisma.
prepararBanco("pedidos");
const { prisma } = await import("../src/lib/db.js");
const { transicionar, validarRegrasDeVenda } = await import("../src/server/pedidos.js");
const { disponivelPorProduto } = await import("../src/server/estoque.js");

let usuarioId: string;

before(async () => {
  usuarioId = (await criarUsuario(prisma)).id;
});

after(async () => {
  await prisma.$disconnect();
});

describe("fluxo do pedido de venda", () => {
  it("percorre o ciclo completo e produz os efeitos em estoque, fiscal e financeiro", async () => {
    const cliente = await criarCliente(prisma);
    const produto = await criarProduto(prisma, { precoVenda: 20, custoMedio: 10 });
    await criarLote(prisma, produto.id, 100);

    const pedido = await criarPedido(prisma, {
      clienteId: cliente.id,
      vendedorId: usuarioId,
      produtoId: produto.id,
      quantidade: 10,
      precoUnitario: 20,
    });

    await transicionar(pedido.id, "AGUARDANDO_APROVACAO", usuarioId);
    await transicionar(pedido.id, "APROVADO", usuarioId);

    // Aprovar reserva o estoque, mas ainda não baixa o saldo físico.
    const lote = await prisma.lote.findFirstOrThrow({ where: { produtoId: produto.id } });
    assert.equal(lote.quantidade, 100, "saldo físico não deve mudar na aprovação");
    assert.equal(lote.quantidadeReservada, 10, "aprovação deve reservar a quantidade");
    assert.equal(await disponivelPorProduto(produto.id), 90, "disponível deve descontar a reserva");

    // A separação é criada automaticamente para a Logística.
    const separacao = await prisma.separacao.findUniqueOrThrow({
      where: { pedidoVendaId: pedido.id },
      include: { itens: true },
    });
    assert.equal(separacao.itens.length, 1);
    assert.equal(separacao.itens[0].quantidadeSolicitada, 10);

    await transicionar(pedido.id, "EM_SEPARACAO", usuarioId);
    await conferirTudo(prisma, pedido.id);
    await transicionar(pedido.id, "CONFERIDO", usuarioId);
    await transicionar(pedido.id, "FATURADO", usuarioId);

    // Faturar emite NF, gera o título a receber e apura comissão.
    const nf = await prisma.notaFiscal.findUniqueOrThrow({ where: { pedidoVendaId: pedido.id } });
    assert.equal(nf.valorTotal, 200);

    const conta = await prisma.contaReceber.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    assert.equal(conta.valor, 200);
    assert.equal(conta.status, "ABERTA");

    const comissao = await prisma.comissao.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    assert.equal(comissao.valor, 6, "comissão de 3% sobre 200");

    await transicionar(pedido.id, "EXPEDIDO", usuarioId);

    // Expedir baixa o estoque consumindo a reserva.
    const loteFinal = await prisma.lote.findFirstOrThrow({ where: { produtoId: produto.id } });
    assert.equal(loteFinal.quantidade, 90, "expedição deve baixar o saldo físico");
    assert.equal(loteFinal.quantidadeReservada, 0, "expedição deve consumir a reserva");

    const movimento = await prisma.movimentoEstoque.findFirstOrThrow({
      where: { origemId: pedido.id, tipo: "SAIDA" },
    });
    assert.equal(movimento.quantidade, -10);

    await transicionar(pedido.id, "EM_TRANSPORTE", usuarioId);
    await transicionar(pedido.id, "ENTREGUE", usuarioId);

    const entrega = await prisma.entrega.findUniqueOrThrow({ where: { pedidoVendaId: pedido.id } });
    assert.equal(entrega.status, "ENTREGUE");

    const final = await prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } });
    assert.equal(final.status, "ENTREGUE");
    assert.ok(final.entregueEm, "data de entrega deve ser registrada");
  });

  it("rejeita transição fora da ordem do fluxo", async () => {
    const cliente = await criarCliente(prisma);
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 50);
    const pedido = await criarPedido(prisma, {
      clienteId: cliente.id,
      vendedorId: usuarioId,
      produtoId: produto.id,
      quantidade: 1,
      precoUnitario: 20,
    });

    // RASCUNHO não pode saltar direto para FATURADO.
    await assert.rejects(
      () => transicionar(pedido.id, "FATURADO", usuarioId),
      /Transição inválida/,
    );
  });

  it("impede aprovação quando o estoque é insuficiente", async () => {
    const cliente = await criarCliente(prisma);
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 5);
    const pedido = await criarPedido(prisma, {
      clienteId: cliente.id,
      vendedorId: usuarioId,
      produtoId: produto.id,
      quantidade: 999,
      precoUnitario: 20,
    });

    await assert.rejects(
      () => transicionar(pedido.id, "AGUARDANDO_APROVACAO", usuarioId),
      /disponível 5, solicitado 999/,
    );
  });

  it("impede venda para cliente bloqueado", async () => {
    const cliente = await criarCliente(prisma, { bloqueado: true });
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 100);
    const pedido = await criarPedido(prisma, {
      clienteId: cliente.id,
      vendedorId: usuarioId,
      produtoId: produto.id,
      quantidade: 1,
      precoUnitario: 20,
    });

    await assert.rejects(() => transicionar(pedido.id, "AGUARDANDO_APROVACAO", usuarioId), /bloqueado/i);
  });

  it("impede venda que estoura o limite de crédito do cliente", async () => {
    const cliente = await criarCliente(prisma, { limiteCredito: 100 });
    const produto = await criarProduto(prisma, { precoVenda: 20 });
    await criarLote(prisma, produto.id, 100);

    // 10 x 20 = 200, acima do limite de 100.
    const pedido = await criarPedido(prisma, {
      clienteId: cliente.id,
      vendedorId: usuarioId,
      produtoId: produto.id,
      quantidade: 10,
      precoUnitario: 20,
    });

    await assert.rejects(() => transicionar(pedido.id, "AGUARDANDO_APROVACAO", usuarioId), /[Ll]imite de crédito/);
  });

  it("considera títulos em aberto ao calcular o limite de crédito disponível", async () => {
    const cliente = await criarCliente(prisma, { limiteCredito: 300 });
    const produto = await criarProduto(prisma, { precoVenda: 20 });
    await criarLote(prisma, produto.id, 100);

    // Já existe R$ 250 em aberto; sobram R$ 50 de limite.
    await prisma.contaReceber.create({
      data: { descricao: "Título anterior", clienteId: cliente.id, valor: 250, vencimento: new Date() },
    });

    const pedido = await criarPedido(prisma, {
      clienteId: cliente.id,
      vendedorId: usuarioId,
      produtoId: produto.id,
      quantidade: 5, // R$ 100 — cabe no limite total, mas não no saldo restante
      precoUnitario: 20,
    });

    const problemas = await validarRegrasDeVenda(pedido.id);
    assert.ok(
      problemas.some((p) => /limite de crédito/i.test(p)),
      `esperava alerta de limite; recebi: ${JSON.stringify(problemas)}`,
    );
  });

  it("bloqueia o avanço quando a conferência tem divergência", async () => {
    const cliente = await criarCliente(prisma);
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 100);
    const pedido = await criarPedido(prisma, {
      clienteId: cliente.id,
      vendedorId: usuarioId,
      produtoId: produto.id,
      quantidade: 10,
      precoUnitario: 20,
    });

    await transicionar(pedido.id, "AGUARDANDO_APROVACAO", usuarioId);
    await transicionar(pedido.id, "APROVADO", usuarioId);
    await transicionar(pedido.id, "EM_SEPARACAO", usuarioId);

    // Confere a menos do que foi pedido.
    const sep = await prisma.separacao.findUniqueOrThrow({
      where: { pedidoVendaId: pedido.id },
      include: { itens: true },
    });
    await prisma.itemSeparacao.update({
      where: { id: sep.itens[0].id },
      data: { quantidadeSeparada: 8, quantidadeConferida: 8 },
    });

    await assert.rejects(() => transicionar(pedido.id, "CONFERIDO", usuarioId), /divergência/i);
  });

  it("devolve a reserva ao estoque quando o pedido é cancelado", async () => {
    const cliente = await criarCliente(prisma);
    const produto = await criarProduto(prisma);
    await criarLote(prisma, produto.id, 100);
    const pedido = await criarPedido(prisma, {
      clienteId: cliente.id,
      vendedorId: usuarioId,
      produtoId: produto.id,
      quantidade: 30,
      precoUnitario: 20,
    });

    await transicionar(pedido.id, "AGUARDANDO_APROVACAO", usuarioId);
    await transicionar(pedido.id, "APROVADO", usuarioId);
    assert.equal(await disponivelPorProduto(produto.id), 70);

    await transicionar(pedido.id, "CANCELADO", usuarioId);
    assert.equal(await disponivelPorProduto(produto.id), 100, "cancelar deve liberar a reserva");
  });
});
