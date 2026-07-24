import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { STATUS_COLABORADOR, rotulo } from "@/lib/constants";
import { data, moeda, numero } from "@/lib/utils";
import { Badge, Card, CardHeader, Indicador, Tabela, Td, Th, TituloPagina, Vazio } from "@/components/ui";
import { Crud, type CampoConfig, type ColunaConfig } from "@/components/crud";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  nome: string;
  matricula: string;
  status: string;
  salario: number;
  dataAdmissao: string;
  departamento: { nome: string } | null;
  cargo: { nome: string } | null;
};

export default async function RhPage() {
  const sessao = await exigirPagina("rh");

  const [colaboradores, departamentos, cargos, treinamentos, documentos] = await Promise.all([
    prisma.colaborador.findMany({
      include: { departamento: { select: { nome: true } }, cargo: { select: { nome: true } } },
      orderBy: { nome: "asc" },
    }),
    prisma.departamento.findMany({ orderBy: { nome: "asc" } }),
    prisma.cargo.findMany({ orderBy: { nome: "asc" } }),
    prisma.treinamento.findMany({ include: { participantes: true }, orderBy: { dataInicio: "desc" } }),
    prisma.documento.findMany({
      include: { colaborador: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 30,
    }),
  ]);

  const ativos = colaboradores.filter((c) => c.status === "ATIVO");
  const folha = ativos.reduce((s, c) => s + c.salario, 0);

  const colunas: ColunaConfig[] = [
    { chave: "nome", label: "Colaborador", sub: "matricula", subFormato: "mono", subPrefixo: "Matrícula " },
    { chave: "departamento.nome", label: "Departamento" },
    { chave: "cargo.nome", label: "Cargo" },
    { chave: "dataAdmissao", label: "Admissão", formato: "data" },
    { chave: "salario", label: "Salário", formato: "moeda", alinhamento: "direita" },
    { chave: "status", label: "Status", formato: "status" },
  ];

  const campos: CampoConfig[] = [
    { nome: "nome", label: "Nome completo", obrigatorio: true, largo: true },
    { nome: "cpf", label: "CPF", obrigatorio: true, placeholder: "000.000.000-00" },
    { nome: "matricula", label: "Matrícula", obrigatorio: true },
    { nome: "email", label: "E-mail" },
    { nome: "telefone", label: "Telefone" },
    { nome: "dataNascimento", label: "Data de nascimento", tipo: "data" },
    { nome: "dataAdmissao", label: "Data de admissão", tipo: "data", obrigatorio: true },
    {
      nome: "departamentoId",
      label: "Departamento",
      tipo: "select",
      opcoes: departamentos.map((d) => ({ valor: d.id, rotulo: d.nome })),
    },
    { nome: "cargoId", label: "Cargo", tipo: "select", opcoes: cargos.map((c) => ({ valor: c.id, rotulo: c.nome })) },
    { nome: "salario", label: "Salário", tipo: "moeda", padrao: 0 },
    {
      nome: "status",
      label: "Situação",
      tipo: "select",
      opcoes: STATUS_COLABORADOR.map((s) => ({ valor: s, rotulo: rotulo(s) })),
      padrao: "ATIVO",
    },
    { nome: "dataDesligamento", label: "Data de desligamento", tipo: "data" },
    { nome: "motivoDesligamento", label: "Motivo do desligamento", tipo: "textarea" },
  ];

  return (
    <>
      <TituloPagina
        modulo="rh"
        titulo="Administrativo / RH / DHO"
        descricao="Gestão de pessoas, documentos, treinamentos e desenvolvimento."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Colaboradores ativos" valor={numero(ativos.length)} />
        <Indicador titulo="Departamentos" valor={numero(departamentos.length)} />
        <Indicador titulo="Folha mensal" valor={moeda(folha)} />
        <Indicador titulo="Treinamentos" valor={numero(treinamentos.length)} />
      </section>

      <div className="mt-6 space-y-6">
        <Crud
          endpoint="/api/colaboradores"
          registros={JSON.parse(JSON.stringify(colaboradores)) as Linha[]}
          colunas={colunas}
          campos={campos}
          rotuloSingular="Colaborador"
          buscaPlaceholder="Buscar por nome, matrícula, cargo..."
          permissoes={{
            criar: pode(sessao, "rh", "CRIAR"),
            editar: pode(sessao, "rh", "EDITAR"),
            excluir: pode(sessao, "rh", "EXCLUIR"),
          }}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader titulo="Treinamentos" descricao="Programas de desenvolvimento e obrigatórios" />
            <Tabela>
              <thead>
                <tr>
                  <Th>Treinamento</Th>
                  <Th className="text-right">Carga</Th>
                  <Th className="text-right">Participantes</Th>
                  <Th>Período</Th>
                  <Th>Tipo</Th>
                </tr>
              </thead>
              <tbody>
                {treinamentos.map((t) => (
                  <tr key={t.id}>
                    <Td className="font-medium text-tinta-900">{t.nome}</Td>
                    <Td className="text-right tabular-nums">{t.cargaHoraria}h</Td>
                    <Td className="text-right tabular-nums">{t.participantes.length}</Td>
                    <Td>{t.dataInicio ? data(t.dataInicio) : "-"}</Td>
                    <Td>
                      <Badge status={t.obrigatorio ? "PENDENTE" : "ATIVO"}>
                        {t.obrigatorio ? "Obrigatório" : "Opcional"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
                {treinamentos.length === 0 ? <Vazio mensagem="Nenhum treinamento cadastrado." colSpan={5} /> : null}
              </tbody>
            </Tabela>
          </Card>

          <Card>
            <CardHeader titulo="Documentos" descricao="Contratos, ASOs, certificados e licenças" />
            <Tabela>
              <thead>
                <tr>
                  <Th>Documento</Th>
                  <Th>Tipo</Th>
                  <Th>Colaborador</Th>
                  <Th>Validade</Th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.id}>
                    <Td className="font-medium text-tinta-900">{d.titulo}</Td>
                    <Td>
                      <Badge>{rotulo(d.tipo)}</Badge>
                    </Td>
                    <Td>{d.colaborador?.nome ?? "-"}</Td>
                    <Td>{data(d.validade)}</Td>
                  </tr>
                ))}
                {documentos.length === 0 ? <Vazio mensagem="Nenhum documento registrado." colSpan={4} /> : null}
              </tbody>
            </Tabela>
          </Card>
        </div>
      </div>
    </>
  );
}
