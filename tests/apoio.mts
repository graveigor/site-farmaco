/**
 * Infraestrutura dos testes.
 *
 * Cada arquivo de teste roda contra o SEU PRÓPRIO banco SQLite temporário
 * (definido por DATABASE_URL antes de importar o Prisma Client), de modo que
 * os testes nunca tocam o dev.db e podem rodar em paralelo sem interferência.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const RAIZ = path.resolve(import.meta.dirname, "..");
const DIR_TMP = path.join(RAIZ, ".tmp-testes");

/**
 * Prepara um banco limpo e aponta DATABASE_URL para ele.
 *
 * IMPORTANTE: deve ser chamada ANTES de importar qualquer módulo que use o
 * cliente Prisma compartilhado (`src/lib/db.ts`), pois esse singleton lê a
 * variável de ambiente no momento do import. Por isso os testes usam
 * `await import(...)` dinâmico depois de chamar esta função.
 */
export function prepararBanco(nome: string): string {
  if (!existsSync(DIR_TMP)) mkdirSync(DIR_TMP, { recursive: true });

  const arquivo = path.join(DIR_TMP, `${nome}.db`);
  rmSync(arquivo, { force: true });
  rmSync(`${arquivo}-journal`, { force: true });

  const url = `file:${arquivo}`;
  process.env.DATABASE_URL = url;

  // Cria o schema no banco recém-criado.
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  return url;
}

/** Data relativa a hoje, em dias (negativo = passado). */
export function emDias(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

type Prisma = PrismaClient;

/** Cria um usuário mínimo para servir de ator nas operações. */
export async function criarUsuario(db: Prisma, dados: Partial<{ area: string; perfil: string }> = {}) {
  return db.usuario.create({
    data: {
      nome: "Usuário de Teste",
      email: `teste-${Math.random().toString(36).slice(2)}@exemplo.com`,
      senhaHash: "x",
      area: dados.area ?? "DIRETORIA",
      perfil: dados.perfil ?? "ADMINISTRADOR",
    },
  });
}

export async function criarCliente(db: Prisma, dados: Partial<{ bloqueado: boolean; limiteCredito: number }> = {}) {
  return db.cliente.create({
    data: {
      razaoSocial: "Cliente de Teste Ltda.",
      cnpj: String(Math.floor(Math.random() * 1e14)).padStart(14, "0"),
      bloqueado: dados.bloqueado ?? false,
      limiteCredito: dados.limiteCredito ?? 0,
    },
  });
}

export async function criarFornecedor(db: Prisma) {
  return db.fornecedor.create({
    data: {
      razaoSocial: "Fornecedor de Teste S.A.",
      cnpj: String(Math.floor(Math.random() * 1e14)).padStart(14, "0"),
      prazoEntregaDias: 5,
    },
  });
}

export async function criarProduto(
  db: Prisma,
  dados: Partial<{ custoMedio: number; precoVenda: number; estoqueMinimo: number }> = {},
) {
  return db.produto.create({
    data: {
      sku: `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      nomeComercial: "Produto de Teste 500mg",
      custoMedio: dados.custoMedio ?? 10,
      precoVenda: dados.precoVenda ?? 20,
      estoqueMinimo: dados.estoqueMinimo ?? 0,
    },
  });
}

/** Cria um lote com saldo. `validadeEmDias` negativo gera lote vencido. */
export async function criarLote(
  db: Prisma,
  produtoId: string,
  quantidade: number,
  validadeEmDias = 365,
  codigo = `L${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
) {
  return db.lote.create({
    data: {
      produtoId,
      codigo,
      dataValidade: emDias(validadeEmDias),
      quantidade,
      custoUnitario: 10,
    },
  });
}

/** Cria um pedido de venda em RASCUNHO com um único item. */
export async function criarPedido(
  db: Prisma,
  params: { clienteId: string; vendedorId: string; produtoId: string; quantidade: number; precoUnitario: number },
) {
  const total = params.quantidade * params.precoUnitario;
  return db.pedidoVenda.create({
    data: {
      numero: `PV-T-${Math.random().toString(36).slice(2, 9)}`,
      clienteId: params.clienteId,
      vendedorId: params.vendedorId,
      subtotal: total,
      valorTotal: total,
      prazoDias: 28,
      itens: {
        create: [
          {
            produtoId: params.produtoId,
            quantidade: params.quantidade,
            precoUnitario: params.precoUnitario,
            total,
          },
        ],
      },
    },
    include: { itens: true },
  });
}

/** Marca a separação como totalmente separada e conferida (simula o armazém). */
export async function conferirTudo(db: Prisma, pedidoId: string) {
  const sep = await db.separacao.findUniqueOrThrow({
    where: { pedidoVendaId: pedidoId },
    include: { itens: true },
  });
  for (const item of sep.itens) {
    await db.itemSeparacao.update({
      where: { id: item.id },
      data: { quantidadeSeparada: item.quantidadeSolicitada, quantidadeConferida: item.quantidadeSolicitada },
    });
  }
}

/** Remove os bancos temporários criados pelos testes. */
export function limparBancos() {
  rmSync(DIR_TMP, { recursive: true, force: true });
}
