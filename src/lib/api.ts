import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { Prisma } from "@prisma/client";
import { obterSessao } from "./auth";
import { pode, type Sessao } from "./permissions";
import type { Acao, Modulo } from "./constants";
import { prisma } from "./db";
import { publicar } from "@/server/eventos";

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const naoAutorizado = () => new ErroApi(401, "Sessão expirada ou inexistente.");
export const semPermissao = () => new ErroApi(403, "Você não tem permissão para esta ação.");
export const naoEncontrado = (o = "Registro") => new ErroApi(404, `${o} não encontrado.`);
export const regraNegocio = (msg: string) => new ErroApi(422, msg);

/**
 * Garante sessao valida e permissao para (modulo, acao). Lanca ErroApi caso
 * contrario. Use sempre no inicio dos handlers de rota.
 */
export async function exigir(modulo: Modulo, acao: Acao = "VER"): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) throw naoAutorizado();
  if (!pode(sessao, modulo, acao)) throw semPermissao();
  return sessao;
}

// Cache de nomes para as notificacoes em tempo real: evita uma consulta a cada
// evento publicado. Nomes de usuario mudam raramente.
const nomesUsuarios = new Map<string, string>();

async function nomeDoUsuario(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const emCache = nomesUsuarios.get(id);
  if (emCache) return emCache;

  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { nome: true } });
  if (!usuario) return null;

  nomesUsuarios.set(id, usuario.nome);
  return usuario.nome;
}

/**
 * Registra uma acao relevante na trilha de auditoria E a publica no barramento
 * de eventos, para que as telas dos demais usuarios se atualizem sozinhas.
 *
 * Este e o ponto unico de integracao da sincronizacao em tempo real: como toda
 * mutacao do sistema ja passa por aqui, nao e preciso instrumentar cada rota.
 */
export async function registrarLog(params: {
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: string | null;
}): Promise<void> {
  try {
    await prisma.logAcao.create({
      data: {
        usuarioId: params.usuarioId ?? null,
        acao: params.acao,
        entidade: params.entidade,
        entidadeId: params.entidadeId ?? null,
        detalhes: params.detalhes ?? null,
      },
    });
  } catch {
    // A auditoria nunca deve derrubar a operacao principal.
  }

  // Login e logout nao alteram dados de negocio: nao ha o que sincronizar.
  if (params.acao === "LOGIN" || params.acao === "LOGOUT") return;

  try {
    publicar({
      entidade: params.entidade,
      acao: params.acao,
      entidadeId: params.entidadeId ?? null,
      usuarioId: params.usuarioId ?? null,
      usuarioNome: await nomeDoUsuario(params.usuarioId),
      detalhes: params.detalhes ?? null,
    });
  } catch {
    // A sincronizacao tambem nunca deve derrubar a operacao principal.
  }
}

/** Converte qualquer erro conhecido em uma resposta JSON consistente. */
export function tratarErro(erro: unknown): NextResponse {
  if (erro instanceof ErroApi) {
    return NextResponse.json({ erro: erro.message }, { status: erro.status });
  }
  if (erro instanceof ZodError) {
    return NextResponse.json(
      {
        erro: "Dados inválidos.",
        campos: erro.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === "P2002") {
      const alvo = (erro.meta?.target as string[] | undefined)?.join(", ") ?? "campo";
      return NextResponse.json({ erro: `Já existe um registro com este ${alvo}.` }, { status: 409 });
    }
    if (erro.code === "P2003" || erro.code === "P2014") {
      return NextResponse.json(
        { erro: "Registro vinculado a outros dados e não pode ser removido." },
        { status: 409 },
      );
    }
    if (erro.code === "P2025") {
      return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
    }
  }
  console.error("[api] erro inesperado:", erro);
  return NextResponse.json({ erro: "Erro interno do servidor." }, { status: 500 });
}

/**
 * Le e valida o corpo JSON da requisicao.
 * Usa `z.infer` para que o tipo retornado seja o de SAIDA do schema (apos
 * transforms e defaults), e nao o de entrada.
 */
export async function corpo<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ErroApi(400, "Corpo da requisição inválido.");
  }
  return schema.parse(json);
}

export const ok = <T>(dados: T, status = 200) => NextResponse.json(dados, { status });

/** Helper de paginacao a partir da query string. */
export function paginacao(req: Request, porPaginaPadrao = 20) {
  const url = new URL(req.url);
  const pagina = Math.max(1, Number(url.searchParams.get("pagina") ?? 1) || 1);
  const porPagina = Math.min(100, Number(url.searchParams.get("porPagina") ?? porPaginaPadrao) || porPaginaPadrao);
  return { pagina, porPagina, skip: (pagina - 1) * porPagina, take: porPagina };
}
