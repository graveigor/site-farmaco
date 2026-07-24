import { redirect } from "next/navigation";
import { obterSessao } from "./auth";
import { pode, type Sessao } from "./permissions";
import type { Acao, Modulo } from "./constants";

/**
 * Guarda para Server Components. Redireciona para o login quando não há sessão
 * e para /sem-acesso quando o usuário não tem permissão no módulo.
 */
export async function exigirPagina(modulo: Modulo, acao: Acao = "VER"): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  if (!pode(sessao, modulo, acao)) redirect("/sem-acesso");
  return sessao;
}
