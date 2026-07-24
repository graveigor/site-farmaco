import { type Acao, type Area, type Modulo, type Perfil } from "./constants";

/**
 * Matriz de permissoes: por AREA definimos quais modulos sao acessiveis, e por
 * PERFIL definimos quais acoes o usuario pode executar dentro desses modulos.
 * A checagem final e a intersecao dos dois (ver `pode`).
 */

const TODOS_MODULOS: Modulo[] = [
  "dashboard",
  "produtos",
  "estoque",
  "fornecedores",
  "compras",
  "clientes",
  "pipeline",
  "pedidos",
  "logistica",
  "devolucoes",
  "financeiro",
  "marketing",
  "rh",
  "usuarios",
  "logs",
  "relatorios",
];

export const MODULOS_POR_AREA: Record<Area, Modulo[]> = {
  // Diretoria enxerga tudo, exceto administracao de usuarios (reservada ao admin
  // pela regra de perfil abaixo).
  DIRETORIA: TODOS_MODULOS,
  FINANCEIRO: ["dashboard", "financeiro", "clientes", "fornecedores", "pedidos", "compras", "relatorios"],
  SUPRIMENTOS: ["dashboard", "produtos", "estoque", "fornecedores", "compras", "relatorios"],
  MARKETING: ["dashboard", "marketing", "produtos", "clientes", "relatorios"],
  COMERCIAL: ["dashboard", "clientes", "pipeline", "pedidos", "produtos", "estoque", "devolucoes", "relatorios"],
  LOGISTICA: ["dashboard", "logistica", "estoque", "produtos", "pedidos", "devolucoes", "relatorios"],
  ADMINISTRATIVO: ["dashboard", "rh", "relatorios"],
};

const ACOES_POR_PERFIL: Record<Perfil, Acao[]> = {
  ADMINISTRADOR: ["VER", "CRIAR", "EDITAR", "EXCLUIR", "APROVAR", "EXPORTAR"],
  PRESIDENCIA: ["VER", "APROVAR", "EXPORTAR"],
  DIRETORIA: ["VER", "CRIAR", "EDITAR", "APROVAR", "EXPORTAR"],
  GERENTE: ["VER", "CRIAR", "EDITAR", "APROVAR", "EXPORTAR"],
  ANALISTA: ["VER", "CRIAR", "EDITAR", "EXPORTAR"],
  OPERADOR: ["VER", "EDITAR"],
};

/** Modulos restritos a perfis especificos, independente da area. */
const MODULOS_RESTRITOS: Partial<Record<Modulo, Perfil[]>> = {
  usuarios: ["ADMINISTRADOR"],
  logs: ["ADMINISTRADOR", "PRESIDENCIA", "DIRETORIA"],
};

export type Sessao = {
  id: string;
  nome: string;
  email: string;
  area: Area;
  perfil: Perfil;
};

export function modulosVisiveis(sessao: Pick<Sessao, "area" | "perfil">): Modulo[] {
  const base = sessao.perfil === "ADMINISTRADOR" ? TODOS_MODULOS : MODULOS_POR_AREA[sessao.area] ?? ["dashboard"];
  return base.filter((m) => {
    const restrito = MODULOS_RESTRITOS[m];
    return !restrito || restrito.includes(sessao.perfil);
  });
}

export function podeAcessarModulo(sessao: Pick<Sessao, "area" | "perfil">, modulo: Modulo): boolean {
  return modulosVisiveis(sessao).includes(modulo);
}

/** Checagem completa: o usuario pode executar `acao` dentro de `modulo`? */
export function pode(
  sessao: Pick<Sessao, "area" | "perfil"> | null | undefined,
  modulo: Modulo,
  acao: Acao = "VER",
): boolean {
  if (!sessao) return false;
  if (!podeAcessarModulo(sessao, modulo)) return false;
  return (ACOES_POR_PERFIL[sessao.perfil] ?? []).includes(acao);
}
