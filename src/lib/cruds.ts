import { criarCrud } from "./crud-api";
import { hashSenha } from "./auth";
import {
  campanhaSchema,
  clienteSchema,
  colaboradorSchema,
  fornecedorSchema,
  oportunidadeSchema,
  produtoSchema,
  usuarioSchema,
} from "./schemas";
import { prisma } from "./db";
import { regraNegocio } from "./api";

// Registro central dos cadastros que seguem o CRUD padrão.

export const crudProdutos = criarCrud({
  modulo: "produtos",
  entidade: "Produto",
  model: "produto",
  schema: produtoSchema,
  include: { fornecedor: { select: { id: true, razaoSocial: true } }, lotes: { select: { quantidade: true } } },
  orderBy: { nomeComercial: "asc" },
  transformar: async (dados) => {
    const d = dados as Record<string, unknown>;
    return { ...d, fornecedorId: d.fornecedorId || null };
  },
});

export const crudFornecedores = criarCrud({
  modulo: "fornecedores",
  entidade: "Fornecedor",
  model: "fornecedor",
  schema: fornecedorSchema,
  orderBy: { razaoSocial: "asc" },
});

export const crudClientes = criarCrud({
  modulo: "clientes",
  entidade: "Cliente",
  model: "cliente",
  schema: clienteSchema,
  orderBy: { razaoSocial: "asc" },
});

export const crudOportunidades = criarCrud({
  modulo: "pipeline",
  entidade: "Oportunidade",
  model: "oportunidade",
  schema: oportunidadeSchema,
  include: { cliente: { select: { razaoSocial: true } }, responsavel: { select: { nome: true } } },
  transformar: async (dados) => {
    const d = dados as Record<string, unknown>;
    return { ...d, clienteId: d.clienteId || null, responsavelId: d.responsavelId || null };
  },
});

export const crudColaboradores = criarCrud({
  modulo: "rh",
  entidade: "Colaborador",
  model: "colaborador",
  schema: colaboradorSchema,
  include: { departamento: true, cargo: true },
  orderBy: { nome: "asc" },
  transformar: async (dados) => {
    const d = dados as Record<string, unknown>;
    return { ...d, departamentoId: d.departamentoId || null, cargoId: d.cargoId || null, email: d.email || null };
  },
});

export const crudUsuarios = criarCrud({
  modulo: "usuarios",
  entidade: "Usuario",
  model: "usuario",
  schema: usuarioSchema,
  orderBy: { nome: "asc" },
  transformar: async (dados, ctx) => {
    const { senha, ...resto } = dados as Record<string, unknown> & { senha?: string };

    if (ctx.criando) {
      if (!senha) throw regraNegocio("Informe uma senha para o novo usuário.");
      return { ...resto, senhaHash: await hashSenha(senha) };
    }
    // Na edição a senha só é alterada quando informada.
    return senha ? { ...resto, senhaHash: await hashSenha(senha) } : resto;
  },
});

/**
 * Campanhas têm relação N:N com produtos, então o vínculo é reescrito a cada
 * gravação em vez de usar o CRUD padrão puro.
 */
export const crudCampanhas = criarCrud({
  modulo: "marketing",
  entidade: "Campanha",
  model: "campanha",
  schema: campanhaSchema,
  include: { produtos: { include: { produto: { select: { id: true, nomeComercial: true } } } } },
  transformar: async (dados, ctx) => {
    const { produtoIds, ...resto } = dados as Record<string, unknown> & { produtoIds?: string[] };
    const ids = produtoIds ?? [];

    if (!ctx.criando && ctx.id) {
      await prisma.campanhaProduto.deleteMany({ where: { campanhaId: ctx.id } });
      if (ids.length) {
        await prisma.campanhaProduto.createMany({
          data: ids.map((produtoId) => ({ campanhaId: ctx.id!, produtoId })),
        });
      }
      return resto;
    }

    return { ...resto, produtos: { create: ids.map((produtoId) => ({ produtoId })) } };
  },
});
