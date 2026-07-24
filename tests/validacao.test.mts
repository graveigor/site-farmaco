import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clienteSchema, loteSchema, pedidoVendaSchema, produtoSchema } from "../src/lib/schemas.js";
import { cnpjValido, proximoNumero } from "../src/lib/utils.js";
import { TRANSICOES_PEDIDO_VENDA } from "../src/lib/constants.js";

describe("validação de CNPJ", () => {
  it("aceita CNPJ com dígitos verificadores corretos", () => {
    assert.ok(cnpjValido("11222333000181"));
    assert.ok(cnpjValido("11.222.333/0001-81"), "deve aceitar formatado");
  });

  it("recusa dígito verificador inválido", () => {
    assert.equal(cnpjValido("11222333000182"), false);
  });

  it("recusa tamanho errado e sequências repetidas", () => {
    assert.equal(cnpjValido("112223330001"), false);
    assert.equal(cnpjValido("11111111111111"), false);
  });
});

describe("schema de produto", () => {
  const base = { sku: "MED-1", nomeComercial: "Teste 500mg" };

  it("normaliza os campos opcionais com valores padrão", () => {
    const r = produtoSchema.parse(base);
    assert.equal(r.status, "ATIVO");
    assert.equal(r.unidadeMedida, "CX");
    assert.equal(r.custoMedio, 0);
  });

  it("recusa estoque máximo menor que o mínimo", () => {
    const r = produtoSchema.safeParse({ ...base, estoqueMinimo: 100, estoqueMaximo: 50 });
    assert.equal(r.success, false);
  });

  it("recusa preço de venda abaixo do custo", () => {
    const r = produtoSchema.safeParse({ ...base, custoMedio: 20, precoVenda: 10 });
    assert.equal(r.success, false);
  });

  it("aceita preço zerado (produto ainda sem precificação)", () => {
    assert.ok(produtoSchema.safeParse({ ...base, custoMedio: 20, precoVenda: 0 }).success);
  });

  it("recusa valores negativos", () => {
    assert.equal(produtoSchema.safeParse({ ...base, custoMedio: -1 }).success, false);
  });
});

describe("schema de lote", () => {
  const base = { produtoId: "abc", codigo: "L1", quantidade: 10 };

  it("recusa validade anterior à fabricação", () => {
    const r = loteSchema.safeParse({
      ...base,
      dataFabricacao: "2026-06-01",
      dataValidade: "2026-01-01",
    });
    assert.equal(r.success, false);
  });

  it("aceita validade posterior à fabricação", () => {
    assert.ok(loteSchema.safeParse({ ...base, dataFabricacao: "2026-01-01", dataValidade: "2028-01-01" }).success);
  });

  it("exige data de validade", () => {
    assert.equal(loteSchema.safeParse(base).success, false);
  });
});

describe("schema de cliente", () => {
  it("remove a máscara do CNPJ", () => {
    const r = clienteSchema.parse({ razaoSocial: "Cliente X", cnpj: "11.222.333/0001-81" });
    assert.equal(r.cnpj, "11222333000181");
  });

  it("recusa CNPJ inválido", () => {
    assert.equal(clienteSchema.safeParse({ razaoSocial: "Cliente X", cnpj: "00000000000000" }).success, false);
  });

  it("recusa UF com tamanho diferente de 2", () => {
    const r = clienteSchema.safeParse({ razaoSocial: "X", cnpj: "11222333000181", uf: "São Paulo" });
    assert.equal(r.success, false);
  });
});

describe("schema de pedido de venda", () => {
  const item = { produtoId: "p1", quantidade: 1, precoUnitario: 10 };

  it("exige ao menos um item", () => {
    const r = pedidoVendaSchema.safeParse({ clienteId: "c1", itens: [] });
    assert.equal(r.success, false);
  });

  it("recusa quantidade zero ou negativa", () => {
    assert.equal(
      pedidoVendaSchema.safeParse({ clienteId: "c1", itens: [{ ...item, quantidade: 0 }] }).success,
      false,
    );
  });

  it("aplica prazo padrão de 30 dias", () => {
    const r = pedidoVendaSchema.parse({ clienteId: "c1", itens: [item] });
    assert.equal(r.prazoDias, 30);
  });
});

describe("numeração sequencial de documentos", () => {
  const ano = new Date().getFullYear();

  it("começa em 0001 quando não há anterior", () => {
    assert.equal(proximoNumero("PV", null), `PV-${ano}-0001`);
  });

  it("incrementa a partir do último número do mesmo ano", () => {
    assert.equal(proximoNumero("PV", `PV-${ano}-0041`), `PV-${ano}-0042`);
  });

  it("reinicia a contagem quando o último é de outro ano", () => {
    assert.equal(proximoNumero("PV", `PV-${ano - 1}-0099`), `PV-${ano}-0001`);
  });
});

describe("máquina de estados do pedido", () => {
  it("não deixa estados finais avançarem", () => {
    assert.deepEqual(TRANSICOES_PEDIDO_VENDA.ENTREGUE, []);
    assert.deepEqual(TRANSICOES_PEDIDO_VENDA.CANCELADO, []);
  });

  it("só permite cancelar antes do faturamento", () => {
    assert.ok(TRANSICOES_PEDIDO_VENDA.APROVADO.includes("CANCELADO"));
    assert.ok(TRANSICOES_PEDIDO_VENDA.CONFERIDO.includes("CANCELADO"));
    // Depois de faturado existe documento fiscal: o caminho é devolução.
    assert.equal(TRANSICOES_PEDIDO_VENDA.FATURADO.includes("CANCELADO"), false);
    assert.equal(TRANSICOES_PEDIDO_VENDA.EXPEDIDO.includes("CANCELADO"), false);
  });

  it("mantém todo estado alcançável a partir do rascunho", () => {
    const alcancados = new Set<string>(["RASCUNHO"]);
    const fila = ["RASCUNHO"];
    while (fila.length) {
      const atual = fila.shift()!;
      for (const proximo of TRANSICOES_PEDIDO_VENDA[atual as keyof typeof TRANSICOES_PEDIDO_VENDA]) {
        if (!alcancados.has(proximo)) {
          alcancados.add(proximo);
          fila.push(proximo);
        }
      }
    }
    const todos = Object.keys(TRANSICOES_PEDIDO_VENDA);
    for (const estado of todos) {
      assert.ok(alcancados.has(estado), `estado ${estado} é inalcançável a partir de RASCUNHO`);
    }
  });
});
