/**
 * Infraestrutura dos testes.
 *
 * Os testes de banco rodam contra um PostgreSQL — o mesmo provider de produção.
 * Cada arquivo usa um SCHEMA Postgres próprio (isolamento), criado a partir de
 * TEST_DATABASE_URL.
 *
 * Quando TEST_DATABASE_URL não está definida (ex.: máquina sem Postgres), os
 * testes de banco se PULAM sozinhos — ver `TEM_BANCO_TESTE` e o padrão usado em
 * cada arquivo de teste. Os testes de lógica pura (permissões, validação,
 * sincronização) não dependem de banco e sempre rodam.
 *
 * Para rodar os testes de banco:
 *   TEST_DATABASE_URL="postgresql://.../teste" npm test
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const RAIZ = new URL("..", import.meta.url).pathname;

/** Há um Postgres de teste disponível? */
export const TEM_BANCO_TESTE = Boolean(process.env.TEST_DATABASE_URL);

// O cliente Prisma exige DATABASE_URL no momento do import, senão lança. Quando
// não há banco de teste, definimos uma URL fictícia só para o import não quebrar
// — nenhuma query roda, porque as suítes de banco ficam puladas.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? "postgresql://ficticio:ficticio@localhost:5432/ficticio?schema=public";
}

/**
 * Prepara um schema Postgres limpo e aponta DATABASE_URL para ele. Retorna
 * `true` quando o banco está disponível e pronto; `false` quando não há
 * TEST_DATABASE_URL (nesse caso a suíte deve se pular).
 *
 * IMPORTANTE: chame ANTES de importar qualquer módulo que use o cliente Prisma
 * compartilhado (`src/lib/db.ts`), pois o singleton lê a variável de ambiente no
 * import. Por isso os testes usam `await import(...)` dinâmico depois desta função.
 */
export function prepararBanco(nome: string): boolean {
  if (!TEM_BANCO_TESTE) return false;

  const base = process.env.TEST_DATABASE_URL as string;
  const schema = `teste_${nome}`;

  // Substitui (ou adiciona) o parâmetro `schema` para isolar cada arquivo.
  const u = new URL(base);
  u.searchParams.set("schema", schema);
  const url = u.toString();
  process.env.DATABASE_URL = url;

  // Cria/atualiza as tabelas no schema isolado deste arquivo de teste.
  // Sem --force-reset: isso derrubaria o banco inteiro. O isolamento vem do
  // schema próprio; as suítes que agregam globalmente limpam suas tabelas.
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  return true;
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

