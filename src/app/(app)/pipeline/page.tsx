import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { ETAPAS_PIPELINE, rotulo } from "@/lib/constants";
import { moeda, numero, percentual } from "@/lib/utils";
import { Card, CardHeader, Indicador, TituloPagina } from "@/components/ui";
import { Crud, type CampoConfig, type ColunaConfig } from "@/components/crud";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  titulo: string;
  etapa: string;
  valorEstimado: number;
  probabilidade: number;
  previsaoFechamento: string | null;
  cliente: { razaoSocial: string } | null;
  prospectNome: string | null;
  responsavel: { nome: string } | null;
};

export default async function PipelinePage() {
  const sessao = await exigirPagina("pipeline");

  const [oportunidades, clientes, usuarios] = await Promise.all([
    prisma.oportunidade.findMany({
      include: { cliente: { select: { razaoSocial: true } }, responsavel: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.cliente.findMany({ select: { id: true, razaoSocial: true }, orderBy: { razaoSocial: "asc" } }),
    prisma.usuario.findMany({ where: { area: "COMERCIAL" }, select: { id: true, nome: true } }),
  ]);

  const abertas = oportunidades.filter((o) => !["GANHA", "PERDIDA"].includes(o.etapa));
  const ganhas = oportunidades.filter((o) => o.etapa === "GANHA");
  // Valor ponderado pela probabilidade — previsão realista do funil.
  const ponderado = abertas.reduce((s, o) => s + (o.valorEstimado * o.probabilidade) / 100, 0);
  const taxaConversao =
    oportunidades.length > 0 ? (ganhas.length / oportunidades.filter((o) => ["GANHA", "PERDIDA"].includes(o.etapa)).length || 0) * 100 : 0;

  // Contagem por etapa para o resumo visual do funil.
  const porEtapa = ETAPAS_PIPELINE.map((etapa) => ({
    etapa,
    itens: oportunidades.filter((o) => o.etapa === etapa),
  }));

  // O valor ponderado é derivado no servidor (colunas do Crud são declarativas).
  const lista = oportunidades.map((o) => ({
    ...o,
    contraparte: o.cliente?.razaoSocial ?? o.prospectNome ?? null,
    responsavelNome: o.responsavel?.nome ?? null,
    ponderado: (o.valorEstimado * o.probabilidade) / 100,
  }));

  const colunas: ColunaConfig[] = [
    { chave: "titulo", label: "Oportunidade" },
    { chave: "contraparte", label: "Cliente / prospect" },
    { chave: "responsavelNome", label: "Responsável" },
    { chave: "etapa", label: "Etapa", formato: "status" },
    { chave: "valorEstimado", label: "Valor", formato: "moeda", alinhamento: "direita" },
    { chave: "probabilidade", label: "Prob.", formato: "numero", alinhamento: "direita" },
    { chave: "ponderado", label: "Ponderado", formato: "moeda", alinhamento: "direita" },
    { chave: "previsaoFechamento", label: "Previsão", formato: "data" },
  ];

  const campos: CampoConfig[] = [
    { nome: "titulo", label: "Título da oportunidade", obrigatorio: true, largo: true },
    {
      nome: "clienteId",
      label: "Cliente existente",
      tipo: "select",
      opcoes: clientes.map((c) => ({ valor: c.id, rotulo: c.razaoSocial })),
    },
    { nome: "prospectNome", label: "Nome do prospect", dica: "Preencha quando ainda não houver cadastro." },
    {
      nome: "etapa",
      label: "Etapa",
      tipo: "select",
      opcoes: ETAPAS_PIPELINE.map((e) => ({ valor: e, rotulo: rotulo(e) })),
      padrao: "PROSPECCAO",
    },
    {
      nome: "responsavelId",
      label: "Responsável",
      tipo: "select",
      opcoes: usuarios.map((u) => ({ valor: u.id, rotulo: u.nome })),
    },
    { nome: "valorEstimado", label: "Valor estimado", tipo: "moeda", padrao: 0 },
    { nome: "probabilidade", label: "Probabilidade (%)", tipo: "numero", padrao: 50 },
    { nome: "previsaoFechamento", label: "Previsão de fechamento", tipo: "data" },
    { nome: "motivoPerda", label: "Motivo da perda", tipo: "textarea" },
  ];

  return (
    <>
      <TituloPagina
        modulo="pipeline" titulo="Pipeline comercial" descricao="Prospecção, negociação e previsão de fechamento." />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Oportunidades abertas" valor={numero(abertas.length)} />
        <Indicador titulo="Valor em negociação" valor={moeda(abertas.reduce((s, o) => s + o.valorEstimado, 0))} />
        <Indicador titulo="Previsão ponderada" valor={moeda(ponderado)} tom="positivo" />
        <Indicador titulo="Taxa de conversão" valor={percentual(taxaConversao)} />
      </section>

      <Card className="mt-6">
        <CardHeader titulo="Funil por etapa" descricao="Distribuição das oportunidades" />
        <div className="rolagem-fina flex gap-3 overflow-x-auto p-4">
          {porEtapa.map(({ etapa, itens }) => (
            <div key={etapa} className="min-w-44 flex-1 rounded-lg bg-tinta-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-tinta-500">{rotulo(etapa)}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-tinta-700">
                  {itens.length}
                </span>
              </div>
              <p className="text-sm font-semibold tabular-nums text-tinta-900">
                {moeda(itens.reduce((s, o) => s + o.valorEstimado, 0))}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6">
        <Crud
          endpoint="/api/oportunidades"
          registros={JSON.parse(JSON.stringify(lista)) as Linha[]}
          colunas={colunas}
          campos={campos}
          rotuloSingular="Oportunidade"
          buscaPlaceholder="Buscar por título, cliente, responsável..."
          permissoes={{
            criar: pode(sessao, "pipeline", "CRIAR"),
            editar: pode(sessao, "pipeline", "EDITAR"),
            excluir: pode(sessao, "pipeline", "EXCLUIR"),
          }}
        />
      </div>
    </>
  );
}
