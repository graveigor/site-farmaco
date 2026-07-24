import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { SEGMENTOS_CLIENTE, rotulo } from "@/lib/constants";
import { cnpjFormatado, moeda } from "@/lib/utils";
import { TituloPagina } from "@/components/ui";
import { Crud, type CampoConfig, type ColunaConfig } from "@/components/crud";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  razaoSocial: string;
  cnpj: string;
  segmento: string | null;
  limiteCredito: number;
  bloqueado: boolean;
  faturado: number;
  emAberto: number;
};

export default async function ClientesPage() {
  const sessao = await exigirPagina("clientes");

  const clientes = await prisma.cliente.findMany({
    include: {
      pedidos: { where: { status: { not: "CANCELADO" } }, select: { valorTotal: true } },
      contasReceber: {
        where: { status: { in: ["ABERTA", "PARCIAL", "VENCIDA"] } },
        select: { valor: true, valorRecebido: true },
      },
    },
    orderBy: { razaoSocial: "asc" },
  });

  // Derivados calculados no servidor: as colunas do Crud são declarativas.
  const lista = clientes.map((c) => ({
    ...c,
    cnpjExibicao: cnpjFormatado(c.cnpj),
    segmentoExibicao: c.segmento ? rotulo(c.segmento) : null,
    cidadeUf: c.cidade ? `${c.cidade}/${c.uf ?? ""}` : null,
    limiteExibicao: c.limiteCredito > 0 ? moeda(c.limiteCredito) : "Sem limite",
    faturado: c.pedidos.reduce((s, p) => s + p.valorTotal, 0),
    emAberto: c.contasReceber.reduce((s, t) => s + (t.valor - t.valorRecebido), 0),
  })) as unknown as Linha[];

  const colunas: ColunaConfig[] = [
    { chave: "razaoSocial", label: "Cliente", sub: "cnpjExibicao", subFormato: "mono" },
    { chave: "segmentoExibicao", label: "Segmento" },
    { chave: "cidadeUf", label: "Cidade/UF" },
    { chave: "faturado", label: "Faturado", formato: "moeda", alinhamento: "direita" },
    { chave: "emAberto", label: "Em aberto", formato: "moeda", alinhamento: "direita" },
    { chave: "limiteExibicao", label: "Limite", alinhamento: "direita" },
    {
      chave: "bloqueado",
      label: "Situação",
      booleano: { verdadeiro: "Bloqueado", falso: "Liberado", statusVerdadeiro: "BLOQUEADO", statusFalso: "ATIVO" },
    },
  ];

  const campos: CampoConfig[] = [
    { nome: "razaoSocial", label: "Razão social", obrigatorio: true },
    { nome: "nomeFantasia", label: "Nome fantasia" },
    { nome: "cnpj", label: "CNPJ", obrigatorio: true, placeholder: "00.000.000/0000-00" },
    { nome: "inscricaoEstadual", label: "Inscrição estadual" },
    {
      nome: "segmento",
      label: "Segmento",
      tipo: "select",
      opcoes: SEGMENTOS_CLIENTE.map((s) => ({ valor: s, rotulo: rotulo(s) })),
    },
    { nome: "contatoNome", label: "Pessoa de contato" },
    { nome: "email", label: "E-mail" },
    { nome: "telefone", label: "Telefone" },
    {
      nome: "limiteCredito",
      label: "Limite de crédito",
      tipo: "moeda",
      padrao: 0,
      dica: "Zero = sem limite. Validado na aprovação do pedido.",
    },
    { nome: "condicaoPagamento", label: "Condição de pagamento", placeholder: "28 dias" },
    { nome: "cep", label: "CEP" },
    { nome: "logradouro", label: "Logradouro" },
    { nome: "numero", label: "Número" },
    { nome: "bairro", label: "Bairro" },
    { nome: "cidade", label: "Cidade" },
    { nome: "uf", label: "UF", placeholder: "SP" },
    { nome: "observacoes", label: "Observações", tipo: "textarea" },
    { nome: "bloqueado", label: "Bloquear para novas vendas", tipo: "checkbox" },
  ];

  return (
    <>
      <TituloPagina
        modulo="clientes" titulo="Clientes" descricao="Carteira de clientes, crédito e situação financeira." />
      <Crud
        endpoint="/api/clientes"
        registros={lista}
        colunas={colunas}
        campos={campos}
        rotuloSingular="Cliente"
        buscaPlaceholder="Buscar por razão social, CNPJ, cidade..."
        permissoes={{
          criar: pode(sessao, "clientes", "CRIAR"),
          editar: pode(sessao, "clientes", "EDITAR"),
          excluir: pode(sessao, "clientes", "EXCLUIR"),
        }}
      />
    </>
  );
}
