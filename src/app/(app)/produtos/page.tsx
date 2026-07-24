import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { UNIDADES_MEDIDA } from "@/lib/constants";
import { TituloPagina } from "@/components/ui";
import { Crud, type CampoConfig, type ColunaConfig } from "@/components/crud";

export const dynamic = "force-dynamic";

type ProdutoLista = {
  id: string;
  sku: string;
  nomeComercial: string;
  principioAtivo: string | null;
  categoria: string | null;
  custoMedio: number;
  precoVenda: number;
  estoqueMinimo: number;
  status: string;
  saldo: number;
  margem: number;
};

export default async function ProdutosPage() {
  const sessao = await exigirPagina("produtos");

  const [produtos, fornecedores] = await Promise.all([
    prisma.produto.findMany({
      include: { lotes: { select: { quantidade: true } } },
      orderBy: { nomeComercial: "asc" },
    }),
    prisma.fornecedor.findMany({ where: { ativo: true }, select: { id: true, razaoSocial: true } }),
  ]);

  const lista: ProdutoLista[] = produtos.map((p) => {
    const saldo = p.lotes.reduce((s, l) => s + l.quantidade, 0);
    return {
      id: p.id,
      sku: p.sku,
      nomeComercial: p.nomeComercial,
      principioAtivo: p.principioAtivo,
      categoria: p.categoria,
      custoMedio: p.custoMedio,
      precoVenda: p.precoVenda,
      estoqueMinimo: p.estoqueMinimo,
      estoqueMaximo: p.estoqueMaximo,
      codigoBarras: p.codigoBarras,
      ncm: p.ncm,
      cest: p.cest,
      fabricante: p.fabricante,
      unidadeMedida: p.unidadeMedida,
      registroAnvisa: p.registroAnvisa,
      exigeReceita: p.exigeReceita,
      controlado: p.controlado,
      fornecedorId: p.fornecedorId,
      status: p.status,
      saldo,
      // Margem sobre o preço de venda.
      margem: p.precoVenda > 0 ? ((p.precoVenda - p.custoMedio) / p.precoVenda) * 100 : 0,
    } as ProdutoLista;
  });

  const colunas: ColunaConfig[] = [
    { chave: "sku", label: "SKU", formato: "mono" },
    { chave: "nomeComercial", label: "Produto", sub: "principioAtivo" },
    { chave: "categoria", label: "Categoria" },
    {
      chave: "saldo",
      label: "Estoque",
      formato: "numero",
      alinhamento: "direita",
      realce: { limite: "estoqueMinimo" },
    },
    { chave: "custoMedio", label: "Custo médio", formato: "moeda", alinhamento: "direita" },
    { chave: "precoVenda", label: "Preço venda", formato: "moeda", alinhamento: "direita" },
    { chave: "margem", label: "Margem", formato: "percentual", alinhamento: "direita" },
    { chave: "status", label: "Status", formato: "status" },
  ];

  const campos: CampoConfig[] = [
    { nome: "sku", label: "SKU", obrigatorio: true, placeholder: "MED-0001" },
    { nome: "nomeComercial", label: "Nome comercial", obrigatorio: true },
    { nome: "principioAtivo", label: "Princípio ativo" },
    { nome: "fabricante", label: "Fabricante" },
    { nome: "categoria", label: "Categoria", placeholder: "Analgésico, Antibiótico..." },
    { nome: "codigoBarras", label: "Código de barras (EAN)" },
    { nome: "ncm", label: "NCM", dica: "Classificação fiscal" },
    { nome: "cest", label: "CEST", dica: "Quando aplicável" },
    {
      nome: "unidadeMedida",
      label: "Unidade de medida",
      tipo: "select",
      opcoes: UNIDADES_MEDIDA.map((u) => ({ valor: u, rotulo: u })),
      padrao: "CX",
    },
    { nome: "registroAnvisa", label: "Registro ANVISA" },
    { nome: "estoqueMinimo", label: "Estoque mínimo", tipo: "numero", padrao: 0 },
    { nome: "estoqueMaximo", label: "Estoque máximo", tipo: "numero", padrao: 0 },
    { nome: "custoMedio", label: "Custo de aquisição", tipo: "moeda", padrao: 0 },
    { nome: "precoVenda", label: "Preço de venda", tipo: "moeda", padrao: 0 },
    {
      nome: "fornecedorId",
      label: "Fornecedor principal",
      tipo: "select",
      opcoes: fornecedores.map((f) => ({ valor: f.id, rotulo: f.razaoSocial })),
    },
    {
      nome: "status",
      label: "Status",
      tipo: "select",
      opcoes: [
        { valor: "ATIVO", rotulo: "Ativo" },
        { valor: "INATIVO", rotulo: "Inativo" },
        { valor: "DESCONTINUADO", rotulo: "Descontinuado" },
      ],
      padrao: "ATIVO",
    },
    { nome: "exigeReceita", label: "Exige receita médica", tipo: "checkbox" },
    { nome: "controlado", label: "Medicamento controlado (Portaria 344)", tipo: "checkbox" },
  ];

  return (
    <>
      <TituloPagina
        modulo="produtos"
        titulo="Produtos"
        descricao="Cadastro de produtos farmacêuticos, precificação e parâmetros de estoque."
      />
      <Crud
        endpoint="/api/produtos"
        registros={lista}
        colunas={colunas}
        campos={campos}
        rotuloSingular="Produto"
        buscaPlaceholder="Buscar por nome, SKU, princípio ativo..."
        permissoes={{
          criar: pode(sessao, "produtos", "CRIAR"),
          editar: pode(sessao, "produtos", "EDITAR"),
          excluir: pode(sessao, "produtos", "EXCLUIR"),
        }}
      />
    </>
  );
}
