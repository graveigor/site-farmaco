import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { dataHora, numero } from "@/lib/utils";
import { Badge, Card, CardHeader, Indicador, Tabela, Td, Th, TituloPagina, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Cores por tipo de ação, para leitura rápida da trilha. */
const COR_ACAO: Record<string, string> = {
  CRIAR: "ATIVO",
  EDITAR: "EM_ANDAMENTO",
  EXCLUIR: "CANCELADO",
  APROVAR: "APROVADO",
  LOGIN: "RASCUNHO",
  LOGOUT: "RASCUNHO",
  EXPORTAR: "PENDENTE",
};

export default async function LogsPage() {
  await exigirPagina("logs");

  const [logs, totalHoje] = await Promise.all([
    prisma.logAcao.findMany({
      include: { usuario: { select: { nome: true, email: true } } },
      orderBy: { criadoEm: "desc" },
      take: 200,
    }),
    prisma.logAcao.count({
      where: { criadoEm: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  const porAcao = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.acao] = (acc[l.acao] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <TituloPagina
        modulo="logs"
        titulo="Trilha de auditoria"
        descricao="Registro das ações relevantes executadas pelos usuários no sistema."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Registros hoje" valor={numero(totalHoje)} />
        <Indicador titulo="Criações" valor={numero(porAcao.CRIAR ?? 0)} />
        <Indicador titulo="Aprovações" valor={numero(porAcao.APROVAR ?? 0)} />
        <Indicador titulo="Exclusões" valor={numero(porAcao.EXCLUIR ?? 0)} tom={porAcao.EXCLUIR ? "atencao" : "neutro"} />
      </section>

      <Card className="mt-6">
        <CardHeader titulo="Últimas ações" descricao="200 registros mais recentes" />
        <Tabela>
          <thead>
            <tr>
              <Th>Data/hora</Th>
              <Th>Usuário</Th>
              <Th>Ação</Th>
              <Th>Entidade</Th>
              <Th>Detalhes</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-tinta-50/60">
                <Td className="whitespace-nowrap font-mono text-xs">{dataHora(l.criadoEm)}</Td>
                <Td>
                  <p className="font-medium text-tinta-900">{l.usuario?.nome ?? "Sistema"}</p>
                  <p className="text-xs text-tinta-500">{l.usuario?.email ?? "-"}</p>
                </Td>
                <Td>
                  <Badge status={COR_ACAO[l.acao] ?? "RASCUNHO"}>{l.acao}</Badge>
                </Td>
                <Td>
                  <p className="font-medium text-tinta-700">{l.entidade}</p>
                  {l.entidadeId ? (
                    <p className="font-mono text-[11px] text-tinta-400">{l.entidadeId.slice(-10)}</p>
                  ) : null}
                </Td>
                <Td className="text-tinta-500">{l.detalhes ?? "-"}</Td>
              </tr>
            ))}
            {logs.length === 0 ? <Vazio mensagem="Nenhuma ação registrada ainda." colSpan={5} /> : null}
          </tbody>
        </Tabela>
      </Card>
    </>
  );
}
