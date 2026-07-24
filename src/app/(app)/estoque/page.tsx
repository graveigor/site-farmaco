import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { DIAS_ALERTA_VALIDADE, DIAS_ALERTA_VALIDADE_CRITICO } from "@/lib/constants";
import { data, dataHora, moeda, numero, diasAte } from "@/lib/utils";
import { Badge, Card, CardHeader, Indicador, Tabela, Td, Th, TituloPagina, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  await exigirPagina("estoque");
  const { filtro } = await searchParams;

  const [lotes, movimentos] = await Promise.all([
    prisma.lote.findMany({
      include: { produto: { select: { nomeComercial: true, sku: true, unidadeMedida: true } } },
      orderBy: { dataValidade: "asc" },
    }),
    prisma.movimentoEstoque.findMany({
      include: { produto: { select: { nomeComercial: true } }, lote: { select: { codigo: true } } },
      orderBy: { criadoEm: "desc" },
      take: 30,
    }),
  ]);

  const hoje = new Date();
  const vencidos = lotes.filter((l) => l.dataValidade < hoje && l.quantidade > 0);
  const aVencer = lotes.filter((l) => {
    const d = diasAte(l.dataValidade);
    return d >= 0 && d <= DIAS_ALERTA_VALIDADE && l.quantidade > 0;
  });

  // Filtro vindo dos cards do dashboard.
  const listaExibida =
    filtro === "vencidos" ? vencidos : filtro === "avencer" ? aVencer : lotes.filter((l) => l.quantidade > 0);

  const valorEstoque = lotes.reduce((s, l) => s + l.quantidade * l.custoUnitario, 0);
  const totalUnidades = lotes.reduce((s, l) => s + l.quantidade, 0);
  const reservado = lotes.reduce((s, l) => s + l.quantidadeReservada, 0);

  return (
    <>
      <TituloPagina
        modulo="estoque"
        titulo="Estoque e lotes"
        descricao="Controle por lote, validade e localização física — base do rastreamento sanitário."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Valor em estoque" valor={moeda(valorEstoque)} detalhe="a custo médio" />
        <Indicador titulo="Unidades em estoque" valor={numero(totalUnidades)} detalhe={`${numero(reservado)} reservadas`} />
        <Indicador titulo="Lotes vencidos" valor={numero(vencidos.length)} tom={vencidos.length ? "critico" : "neutro"} href="/estoque?filtro=vencidos" />
        <Indicador titulo="Próximos do vencimento" valor={numero(aVencer.length)} tom={aVencer.length ? "atencao" : "neutro"} href="/estoque?filtro=avencer" />
      </section>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            titulo={
              filtro === "vencidos"
                ? "Lotes vencidos"
                : filtro === "avencer"
                  ? "Lotes próximos do vencimento"
                  : "Posição de estoque por lote"
            }
            descricao={`${listaExibida.length} lote(s) — ordenados por validade (FEFO)`}
            acoes={
              filtro ? (
                <a href="/estoque" className="text-sm font-medium text-marca-700 hover:underline">
                  Limpar filtro
                </a>
              ) : null
            }
          />
          <Tabela>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th>Lote</Th>
                <Th>Fabricação</Th>
                <Th>Validade</Th>
                <Th>Situação</Th>
                <Th>Localização</Th>
                <Th className="text-right">Disponível</Th>
                <Th className="text-right">Reservado</Th>
                <Th className="text-right">Valor</Th>
              </tr>
            </thead>
            <tbody>
              {listaExibida.map((l) => {
                const dias = diasAte(l.dataValidade);
                return (
                  <tr key={l.id} className="hover:bg-tinta-50/60">
                    <Td>
                      <p className="font-medium text-tinta-900">{l.produto.nomeComercial}</p>
                      <p className="font-mono text-xs text-tinta-500">{l.produto.sku}</p>
                    </Td>
                    <Td className="font-mono text-xs">{l.codigo}</Td>
                    <Td>{data(l.dataFabricacao)}</Td>
                    <Td>{data(l.dataValidade)}</Td>
                    <Td>
                      {dias < 0 ? (
                        <Badge status="VENCIDA">Vencido há {Math.abs(dias)}d</Badge>
                      ) : dias <= DIAS_ALERTA_VALIDADE_CRITICO ? (
                        <Badge status="PENDENTE">Vence em {dias}d</Badge>
                      ) : dias <= DIAS_ALERTA_VALIDADE ? (
                        <Badge status="EM_ANDAMENTO">Vence em {dias}d</Badge>
                      ) : (
                        <Badge status="ATIVO">Regular</Badge>
                      )}
                    </Td>
                    <Td className="font-mono text-xs text-tinta-500">{l.localizacao ?? "-"}</Td>
                    <Td className="text-right tabular-nums font-medium">
                      {numero(l.quantidade - l.quantidadeReservada)}
                    </Td>
                    <Td className="text-right tabular-nums text-tinta-500">{numero(l.quantidadeReservada)}</Td>
                    <Td className="text-right tabular-nums">{moeda(l.quantidade * l.custoUnitario)}</Td>
                  </tr>
                );
              })}
              {listaExibida.length === 0 ? <Vazio mensagem="Nenhum lote nesta condição." colSpan={9} /> : null}
            </tbody>
          </Tabela>
        </Card>

        <Card>
          <CardHeader titulo="Movimentações recentes" descricao="Kardex — últimas 30 movimentações" />
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Produto</Th>
                <Th>Lote</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Quantidade</Th>
                <Th className="text-right">Saldo após</Th>
                <Th>Motivo</Th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap">{dataHora(m.criadoEm)}</Td>
                  <Td className="font-medium text-tinta-900">{m.produto.nomeComercial}</Td>
                  <Td className="font-mono text-xs">{m.lote?.codigo ?? "-"}</Td>
                  <Td>
                    <Badge status={m.quantidade >= 0 ? "ATIVO" : "CANCELADO"}>{m.tipo}</Badge>
                  </Td>
                  <Td className={`text-right tabular-nums font-medium ${m.quantidade >= 0 ? "text-marca-700" : "text-red-600"}`}>
                    {m.quantidade >= 0 ? "+" : ""}
                    {numero(m.quantidade)}
                  </Td>
                  <Td className="text-right tabular-nums">{numero(m.saldoApos)}</Td>
                  <Td className="text-tinta-500">{m.motivo ?? "-"}</Td>
                </tr>
              ))}
              {movimentos.length === 0 ? <Vazio mensagem="Sem movimentações." colSpan={7} /> : null}
            </tbody>
          </Tabela>
        </Card>
      </div>
    </>
  );
}
