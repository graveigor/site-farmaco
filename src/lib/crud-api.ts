import type { ZodTypeAny, z } from "zod";
import { prisma } from "./db";
import { corpo, exigir, naoEncontrado, ok, registrarLog, tratarErro } from "./api";
import type { Modulo } from "./constants";

type Delegate = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<{ id: string }>;
  update: (args: unknown) => Promise<{ id: string }>;
  delete: (args: unknown) => Promise<unknown>;
};

/**
 * Gera os handlers REST padrão de um cadastro, já com controle de permissão,
 * validação Zod e registro na trilha de auditoria. Módulos com regra de
 * negócio própria (pedidos, compras, logística) implementam rotas dedicadas.
 */
export function criarCrud<S extends ZodTypeAny, T = z.infer<S>>(config: {
  modulo: Modulo;
  entidade: string;
  schema: S;
  /** Nome do model no Prisma Client, ex.: "produto". */
  model: string;
  include?: Record<string, unknown>;
  orderBy?: Record<string, unknown>;
  /** Ajusta o payload validado antes de gravar (ex.: hash de senha). */
  transformar?: (dados: T, contexto: { criando: boolean; id?: string }) => Promise<Record<string, unknown>>;
}) {
  const delegate = () => (prisma as unknown as Record<string, Delegate>)[config.model];

  return {
    async GET() {
      try {
        await exigir(config.modulo, "VER");
        const registros = await delegate().findMany({
          include: config.include,
          orderBy: config.orderBy ?? { criadoEm: "desc" },
        });
        return ok(registros);
      } catch (erro) {
        return tratarErro(erro);
      }
    },

    async POST(req: Request) {
      try {
        const sessao = await exigir(config.modulo, "CRIAR");
        const dados = await corpo(req, config.schema);
        const payload = config.transformar ? await config.transformar(dados, { criando: true }) : (dados as object);

        const criado = await delegate().create({ data: payload });
        await registrarLog({
          usuarioId: sessao.id,
          acao: "CRIAR",
          entidade: config.entidade,
          entidadeId: criado.id,
        });
        return ok(criado, 201);
      } catch (erro) {
        return tratarErro(erro);
      }
    },

    async PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
      try {
        const sessao = await exigir(config.modulo, "EDITAR");
        const { id } = await ctx.params;

        const existente = await delegate().findUnique({ where: { id } });
        if (!existente) throw naoEncontrado(config.entidade);

        const dados = await corpo(req, config.schema);
        const payload = config.transformar ? await config.transformar(dados, { criando: false, id }) : (dados as object);

        const atualizado = await delegate().update({ where: { id }, data: payload });
        await registrarLog({ usuarioId: sessao.id, acao: "EDITAR", entidade: config.entidade, entidadeId: id });
        return ok(atualizado);
      } catch (erro) {
        return tratarErro(erro);
      }
    },

    async DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
      try {
        const sessao = await exigir(config.modulo, "EXCLUIR");
        const { id } = await ctx.params;

        await delegate().delete({ where: { id } });
        await registrarLog({ usuarioId: sessao.id, acao: "EXCLUIR", entidade: config.entidade, entidadeId: id });
        return ok({ id });
      } catch (erro) {
        return tratarErro(erro);
      }
    },
  };
}
