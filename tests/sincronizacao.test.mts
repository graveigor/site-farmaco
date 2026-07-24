import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ENTIDADES, VERBOS, descreverEvento, rotaAfetada } from "../src/lib/eventos-mapa.js";

/**
 * Entidades que o sistema realmente publica no barramento (todas as chamadas a
 * `registrarLog` nas rotas de API). Se alguém criar um módulo novo e esquecer
 * de mapeá-lo, o teste de cobertura abaixo acusa.
 */
const ENTIDADES_EMITIDAS = [
  "Produto",
  "Fornecedor",
  "Cliente",
  "Oportunidade",
  "Colaborador",
  "Usuario",
  "Campanha",
  "PedidoVenda",
  "PedidoCompra",
  "Separacao",
  "Entrega",
  "Devolucao",
  "ContaPagar",
  "ContaReceber",
];

describe("impacto de evento por rota", () => {
  it("recarrega a lista de clientes quando um cliente muda", () => {
    assert.ok(rotaAfetada("Cliente", "/clientes"));
  });

  it("recarrega o dashboard para praticamente tudo", () => {
    for (const entidade of ENTIDADES_EMITIDAS.filter((e) => e !== "Usuario")) {
      assert.ok(rotaAfetada(entidade, "/dashboard"), `${entidade} deveria afetar o dashboard`);
    }
  });

  it("NÃO recarrega o RH quando alguém mexe em cliente", () => {
    // Regressão: sem esse filtro, toda tela recarregaria a cada alteração
    // de qualquer módulo.
    assert.equal(rotaAfetada("Cliente", "/rh"), false);
    assert.equal(rotaAfetada("Produto", "/rh"), false);
    assert.equal(rotaAfetada("ContaPagar", "/rh"), false);
  });

  it("recarrega o RH quando muda um colaborador", () => {
    assert.ok(rotaAfetada("Colaborador", "/rh"));
  });

  it("propaga o pedido de venda para comercial, logística e financeiro", () => {
    for (const rota of ["/pedidos", "/logistica", "/financeiro"]) {
      assert.ok(rotaAfetada("PedidoVenda", rota), `pedido deveria afetar ${rota}`);
    }
  });

  it("propaga o recebimento de compra para estoque e financeiro", () => {
    for (const rota of ["/estoque", "/financeiro", "/compras"]) {
      assert.ok(rotaAfetada("PedidoCompra", rota), `compra deveria afetar ${rota}`);
    }
  });

  it("trata subrotas como parte da rota base", () => {
    assert.ok(rotaAfetada("Cliente", "/clientes/abc123"));
  });

  it("ignora entidade desconhecida em vez de quebrar", () => {
    assert.equal(rotaAfetada("EntidadeInexistente", "/dashboard"), false);
  });
});

describe("cobertura do mapa", () => {
  it("mapeia toda entidade que o sistema publica", () => {
    const naoMapeadas = ENTIDADES_EMITIDAS.filter((e) => !ENTIDADES[e]);
    assert.deepEqual(
      naoMapeadas,
      [],
      `entidades sem mapa de impacto (não vão atualizar tela nenhuma): ${naoMapeadas.join(", ")}`,
    );
  });

  it("não deixa entidade mapeada sem nenhuma rota", () => {
    for (const [nome, d] of Object.entries(ENTIDADES)) {
      assert.ok(d.rotas.length > 0, `${nome} não tem rotas`);
    }
  });

  it("usa rotas absolutas", () => {
    for (const [nome, d] of Object.entries(ENTIDADES)) {
      for (const r of d.rotas) {
        assert.ok(r.startsWith("/"), `${nome} tem rota relativa: ${r}`);
      }
    }
  });
});

describe("texto da notificação", () => {
  it("monta a frase com primeiro nome, verbo e artigo corretos", () => {
    assert.equal(
      descreverEvento({ usuarioNome: "Fernando Lopes", acao: "CRIAR", entidade: "Cliente" }),
      "Fernando cadastrou um cliente",
    );
  });

  it("concorda o artigo com o gênero da entidade", () => {
    assert.equal(
      descreverEvento({ usuarioNome: "Ana Ribeiro", acao: "CRIAR", entidade: "Campanha" }),
      "Ana cadastrou uma campanha",
    );
  });

  it("usa o verbo certo para cada ação", () => {
    assert.match(
      descreverEvento({ usuarioNome: "Ana", acao: "APROVAR", entidade: "PedidoCompra" })!,
      /aprovou um pedido de compra/,
    );
    assert.match(
      descreverEvento({ usuarioNome: "Ana", acao: "EXCLUIR", entidade: "Produto" })!,
      /excluiu um produto/,
    );
  });

  it("não inventa frase para entidade ou ação desconhecida", () => {
    assert.equal(descreverEvento({ usuarioNome: "Ana", acao: "CRIAR", entidade: "Xpto" }), null);
    assert.equal(descreverEvento({ usuarioNome: "Ana", acao: "DANCAR", entidade: "Cliente" }), null);
  });

  it("tem alternativa quando o nome do usuário não veio", () => {
    assert.match(descreverEvento({ usuarioNome: null, acao: "CRIAR", entidade: "Cliente" })!, /^Alguém/);
  });

  it("cobre todas as ações de escrita do sistema", () => {
    for (const acao of ["CRIAR", "EDITAR", "EXCLUIR", "APROVAR"]) {
      assert.ok(VERBOS[acao], `ação ${acao} sem verbo definido`);
    }
  });
});
