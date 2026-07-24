import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { modulosVisiveis, pode } from "../src/lib/permissions.js";
import type { Area, Perfil } from "../src/lib/constants.js";

const sessao = (area: Area, perfil: Perfil) => ({ area, perfil });

describe("acesso por área", () => {
  it("dá ao administrador acesso a todos os módulos", () => {
    const modulos = modulosVisiveis(sessao("DIRETORIA", "ADMINISTRADOR"));
    for (const m of ["financeiro", "usuarios", "logs", "rh", "logistica", "marketing"] as const) {
      assert.ok(modulos.includes(m), `administrador deveria ver ${m}`);
    }
  });

  it("impede que o Comercial acesse o Financeiro", () => {
    assert.equal(pode(sessao("COMERCIAL", "GERENTE"), "financeiro"), false);
  });

  it("impede que a Logística acesse clientes e compras", () => {
    const logistica = sessao("LOGISTICA", "GERENTE");
    assert.equal(pode(logistica, "clientes"), false);
    assert.equal(pode(logistica, "compras"), false);
  });

  it("libera para a Logística os módulos da sua operação", () => {
    const logistica = sessao("LOGISTICA", "GERENTE");
    for (const m of ["logistica", "estoque", "pedidos", "devolucoes"] as const) {
      assert.ok(pode(logistica, m), `logística deveria acessar ${m}`);
    }
  });

  it("restringe o RH ao seu próprio módulo", () => {
    const rh = sessao("ADMINISTRATIVO", "GERENTE");
    assert.ok(pode(rh, "rh"));
    assert.equal(pode(rh, "pedidos"), false);
    assert.equal(pode(rh, "estoque"), false);
  });
});

describe("módulos restritos por perfil", () => {
  it("reserva a gestão de usuários ao administrador", () => {
    assert.ok(pode(sessao("DIRETORIA", "ADMINISTRADOR"), "usuarios"));
    // Nem a diretoria administra usuários.
    assert.equal(pode(sessao("DIRETORIA", "DIRETORIA"), "usuarios"), false);
    assert.equal(pode(sessao("ADMINISTRATIVO", "GERENTE"), "usuarios"), false);
  });

  it("limita a auditoria a administrador, presidência e diretoria", () => {
    assert.ok(pode(sessao("DIRETORIA", "PRESIDENCIA"), "logs"));
    assert.ok(pode(sessao("DIRETORIA", "DIRETORIA"), "logs"));
    assert.equal(pode(sessao("FINANCEIRO", "GERENTE"), "logs"), false);
  });
});

describe("ações por perfil", () => {
  it("permite ao operador ver e editar, mas não aprovar nem excluir", () => {
    const operador = sessao("LOGISTICA", "OPERADOR");
    assert.ok(pode(operador, "logistica", "VER"));
    assert.ok(pode(operador, "logistica", "EDITAR"));
    assert.equal(pode(operador, "logistica", "APROVAR"), false);
    assert.equal(pode(operador, "logistica", "EXCLUIR"), false);
    assert.equal(pode(operador, "logistica", "CRIAR"), false);
  });

  it("dá à presidência leitura e aprovação, sem edição direta", () => {
    const presidencia = sessao("DIRETORIA", "PRESIDENCIA");
    assert.ok(pode(presidencia, "compras", "VER"));
    assert.ok(pode(presidencia, "compras", "APROVAR"));
    assert.equal(pode(presidencia, "compras", "EDITAR"), false);
    assert.equal(pode(presidencia, "compras", "EXCLUIR"), false);
  });

  it("permite ao analista criar e editar, mas não aprovar", () => {
    const analista = sessao("SUPRIMENTOS", "ANALISTA");
    assert.ok(pode(analista, "compras", "CRIAR"));
    assert.ok(pode(analista, "compras", "EDITAR"));
    assert.equal(pode(analista, "compras", "APROVAR"), false);
  });

  it("reserva a exclusão ao administrador", () => {
    assert.ok(pode(sessao("DIRETORIA", "ADMINISTRADOR"), "produtos", "EXCLUIR"));
    assert.equal(pode(sessao("SUPRIMENTOS", "GERENTE"), "produtos", "EXCLUIR"), false);
    assert.equal(pode(sessao("DIRETORIA", "DIRETORIA"), "produtos", "EXCLUIR"), false);
  });
});

describe("borda", () => {
  it("nega tudo quando não há sessão", () => {
    assert.equal(pode(null, "dashboard", "VER"), false);
    assert.equal(pode(undefined, "dashboard", "VER"), false);
  });

  it("exige acesso ao módulo mesmo com perfil poderoso", () => {
    // Administrador do RH ainda assim não perde acesso (é admin), mas um
    // gerente do RH não ganha o Financeiro só por ser gerente.
    assert.equal(pode(sessao("ADMINISTRATIVO", "GERENTE"), "financeiro", "VER"), false);
  });

  it("dá a todas as áreas acesso ao dashboard", () => {
    const areas: Area[] = [
      "DIRETORIA",
      "FINANCEIRO",
      "SUPRIMENTOS",
      "MARKETING",
      "COMERCIAL",
      "LOGISTICA",
      "ADMINISTRATIVO",
    ];
    for (const area of areas) {
      assert.ok(pode(sessao(area, "ANALISTA"), "dashboard"), `${area} deveria ver o dashboard`);
    }
  });
});
