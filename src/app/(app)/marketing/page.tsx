import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { STATUS_CAMPANHA, rotulo } from "@/lib/constants";
import { data, moeda, numero, percentual } from "@/lib/utils";
import { Indicador, TituloPagina } from "@/components/ui";
import { Crud, type CampoConfig, type ColunaConfig } from "@/components/crud";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  nome: string;
  canal: string | null;
  publicoAlvo: string | null;
  orcamento: number;
  investido: number;
  dataInicio: string;
  dataFim: string;
  status: string;
  produtos: { produto: { nomeComercial: string } }[];
};

export default async function MarketingPage() {
  const sessao = await exigirPagina("marketing");

  const campanhas = await prisma.campanha.findMany({
    include: { produtos: { include: { produto: { select: { nomeComercial: true } } } }, materiais: true },
    orderBy: { dataInicio: "desc" },
  });

  const ativas = campanhas.filter((c) => c.status === "EM_ANDAMENTO");
  const orcamentoTotal = campanhas.reduce((s, c) => s + c.orcamento, 0);
  const investidoTotal = campanhas.reduce((s, c) => s + c.investido, 0);

  const lista = campanhas.map((c) => ({
    ...c,
    canalExibicao: c.canal ? rotulo(c.canal) : null,
    periodo: `${data(c.dataInicio)} — ${data(c.dataFim)}`,
    qtdProdutos: c.produtos.length,
    consumoOrcamento: c.orcamento > 0 ? `${percentual((c.investido / c.orcamento) * 100, 0)} do orçamento` : null,
  }));

  const colunas: ColunaConfig[] = [
    { chave: "nome", label: "Campanha", sub: "publicoAlvo" },
    { chave: "canalExibicao", label: "Canal" },
    { chave: "periodo", label: "Período" },
    { chave: "qtdProdutos", label: "Produtos", formato: "numero", alinhamento: "direita" },
    { chave: "orcamento", label: "Orçamento", formato: "moeda", alinhamento: "direita" },
    {
      chave: "investido",
      label: "Investido",
      formato: "moeda",
      alinhamento: "direita",
      sub: "consumoOrcamento",
    },
    { chave: "status", label: "Status", formato: "status" },
  ];

  const campos: CampoConfig[] = [
    { nome: "nome", label: "Nome da campanha", obrigatorio: true, largo: true },
    { nome: "descricao", label: "Descrição", tipo: "textarea" },
    {
      nome: "canal",
      label: "Canal",
      tipo: "select",
      opcoes: ["REDES_SOCIAIS", "EMAIL", "EVENTO", "VISITA", "MATERIAL_IMPRESSO"].map((c) => ({
        valor: c,
        rotulo: rotulo(c),
      })),
    },
    { nome: "publicoAlvo", label: "Público-alvo", placeholder: "Drogarias independentes, redes regionais..." },
    { nome: "dataInicio", label: "Início", tipo: "data", obrigatorio: true },
    { nome: "dataFim", label: "Término", tipo: "data", obrigatorio: true },
    { nome: "orcamento", label: "Orçamento", tipo: "moeda", padrao: 0 },
    { nome: "investido", label: "Investido até o momento", tipo: "moeda", padrao: 0 },
    {
      nome: "status",
      label: "Status",
      tipo: "select",
      opcoes: STATUS_CAMPANHA.map((s) => ({ valor: s, rotulo: rotulo(s) })),
      padrao: "PLANEJADA",
    },
    { nome: "resultados", label: "Resultados obtidos", tipo: "textarea" },
  ];

  return (
    <>
      <TituloPagina
        modulo="marketing" titulo="Marketing" descricao="Campanhas, materiais promocionais e desempenho." />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Campanhas ativas" valor={numero(ativas.length)} tom="positivo" />
        <Indicador titulo="Total de campanhas" valor={numero(campanhas.length)} />
        <Indicador titulo="Orçamento total" valor={moeda(orcamentoTotal)} />
        <Indicador
          titulo="Investido"
          valor={moeda(investidoTotal)}
          detalhe={orcamentoTotal > 0 ? `${percentual((investidoTotal / orcamentoTotal) * 100, 0)} do orçamento` : undefined}
        />
      </section>

      <div className="mt-6">
        <Crud
          endpoint="/api/campanhas"
          registros={JSON.parse(JSON.stringify(lista)) as Linha[]}
          colunas={colunas}
          campos={campos}
          rotuloSingular="Campanha"
          buscaPlaceholder="Buscar por nome, canal, público..."
          permissoes={{
            criar: pode(sessao, "marketing", "CRIAR"),
            editar: pode(sessao, "marketing", "EDITAR"),
            excluir: pode(sessao, "marketing", "EXCLUIR"),
          }}
        />
      </div>
    </>
  );
}
