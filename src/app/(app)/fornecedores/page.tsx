import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { cnpjFormatado } from "@/lib/utils";
import { TituloPagina } from "@/components/ui";
import { Crud, type CampoConfig, type ColunaConfig } from "@/components/crud";

export const dynamic = "force-dynamic";

type Linha = { id: string; razaoSocial: string; cnpj: string; ativo: boolean; totalCompras: number; qtdProdutos: number };

export default async function FornecedoresPage() {
  const sessao = await exigirPagina("fornecedores");

  const fornecedores = await prisma.fornecedor.findMany({
    include: {
      _count: { select: { produtos: true } },
      pedidosCompra: { where: { status: { notIn: ["CANCELADO", "REJEITADO"] } }, select: { valorTotal: true } },
    },
    orderBy: { razaoSocial: "asc" },
  });

  // Campos derivados são pré-calculados aqui porque as colunas do Crud são
  // declarativas (serializáveis) e não executam funções no cliente.
  const lista = fornecedores.map((f) => ({
    ...f,
    cnpjExibicao: cnpjFormatado(f.cnpj),
    cidadeUf: f.cidade ? `${f.cidade}/${f.uf ?? ""}` : null,
    contato: f.telefone ?? f.email ?? null,
    prazoExibicao: `${f.prazoEntregaDias} dias`,
    totalCompras: f.pedidosCompra.reduce((s, p) => s + p.valorTotal, 0),
    qtdProdutos: f._count.produtos,
  })) as unknown as Linha[];

  const colunas: ColunaConfig[] = [
    { chave: "razaoSocial", label: "Fornecedor", sub: "cnpjExibicao", subFormato: "mono" },
    { chave: "cidadeUf", label: "Cidade/UF" },
    { chave: "contato", label: "Contato" },
    { chave: "qtdProdutos", label: "Produtos", formato: "numero", alinhamento: "direita" },
    { chave: "prazoExibicao", label: "Prazo entrega", alinhamento: "direita" },
    { chave: "totalCompras", label: "Total comprado", formato: "moeda", alinhamento: "direita" },
    {
      chave: "ativo",
      label: "Status",
      booleano: { verdadeiro: "Ativo", falso: "Inativo", statusVerdadeiro: "ATIVO", statusFalso: "INATIVO" },
    },
  ];

  const campos: CampoConfig[] = [
    { nome: "razaoSocial", label: "Razão social", obrigatorio: true },
    { nome: "nomeFantasia", label: "Nome fantasia" },
    { nome: "cnpj", label: "CNPJ", obrigatorio: true, placeholder: "00.000.000/0000-00" },
    { nome: "inscricaoEstadual", label: "Inscrição estadual" },
    { nome: "contatoNome", label: "Pessoa de contato" },
    { nome: "email", label: "E-mail" },
    { nome: "telefone", label: "Telefone" },
    { nome: "prazoEntregaDias", label: "Prazo de entrega (dias)", tipo: "numero", padrao: 7 },
    { nome: "condicaoPagamento", label: "Condição de pagamento", placeholder: "30/60/90 dias" },
    { nome: "cep", label: "CEP" },
    { nome: "logradouro", label: "Logradouro" },
    { nome: "numero", label: "Número" },
    { nome: "bairro", label: "Bairro" },
    { nome: "cidade", label: "Cidade" },
    { nome: "uf", label: "UF", placeholder: "SP" },
    { nome: "observacoes", label: "Observações", tipo: "textarea" },
    { nome: "ativo", label: "Fornecedor ativo", tipo: "checkbox", padrao: true },
  ];

  return (
    <>
      <TituloPagina
        modulo="fornecedores" titulo="Fornecedores" descricao="Cadastro, condições comerciais e histórico de compras." />
      <Crud
        endpoint="/api/fornecedores"
        registros={lista}
        colunas={colunas}
        campos={campos}
        rotuloSingular="Fornecedor"
        buscaPlaceholder="Buscar por razão social, CNPJ, cidade..."
        permissoes={{
          criar: pode(sessao, "fornecedores", "CRIAR"),
          editar: pode(sessao, "fornecedores", "EDITAR"),
          excluir: pode(sessao, "fornecedores", "EXCLUIR"),
        }}
      />
    </>
  );
}
