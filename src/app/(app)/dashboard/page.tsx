import Link from "next/link";
import { exigirPagina } from "@/lib/guard";
import { indicadores } from "@/server/dashboard";
import { pode } from "@/lib/permissions";
import { moeda, numero, data, diasAte } from "@/lib/utils";
import { DIAS_ALERTA_VALIDADE_CRITICO } from "@/lib/constants";
import { Badge, Card, CardBody, CardHeader, Indicador, Tabela, Td, Th, TituloPagina, Vazio } from "@/components/ui";
import { GraficoBarras, GraficoRosca } from "@/components/graficos";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const sessao = await exigirPagina("dashboard");
  const d = await indicadores();

  const verFinanceiro = pode(sessao, "financeiro");
  const verEstoque = pode(sessao, "estoque");
  const verPedidos = pode(sessao, "pedidos");

  return (
    <>
      <TituloPagina
        modulo="dashboard"
        titulo={`Bem-vindo, ${sessao.nome.split(" ")[0]}`}
        descricao="Visão consolidada da operação da distribuidora."
      />

      {/* Indicadores principais */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Faturamento do mês"
          valor={moeda(d.faturamento.mes)}
          variacao={d.faturamento.variacao}
          detalhe={`${d.faturamento.pedidos} pedidos faturados`}
          tom="positivo"
        />
        {verFinanceiro ? (
          <>
            <Indicador titulo="Contas a receber" valor={moeda(d.financeiro.aReceber)} href="/financeiro?aba=receber" />
            <Indicador titulo="Contas a pagar" valor={moeda(d.financeiro.aPagar)} href="/financeiro?aba=pagar" />
            <Indicador
              titulo="Inadimplência"
              valor={moeda(d.financeiro.inadimplencia)}
              detalhe={`${d.financeiro.titulosVencidos} títulos vencidos`}
              tom={d.financeiro.inadimplencia > 0 ? "critico" : "neutro"}
              href="/financeiro?aba=receber&status=VENCIDA"
            />
          </>
        ) : (
          <>
            <Indicador titulo="Pedidos pendentes" valor={numero(d.pedidos.pendentes)} tom="atencao" href="/pedidos" />
            <Indicador titulo="Em separação" valor={numero(d.pedidos.emSeparacao)} href="/logistica" />
            <Indicador titulo="Em transporte" valor={numero(d.pedidos.enviados)} href="/logistica" />
          </>
        )}
      </section>

      {/* Alertas de estoque — críticos para operação farmacêutica */}
      {verEstoque && (d.estoque.vencidos > 0 || d.estoque.aVencer > 0 || d.estoque.estoqueBaixo > 0) ? (
        <section className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Indicador titulo="Lotes vencidos" valor={numero(d.estoque.vencidos)} tom="critico" href="/estoque?filtro=vencidos" />
          <Indicador titulo="Próximos do vencimento" valor={numero(d.estoque.aVencer)} tom="atencao" href="/estoque?filtro=avencer" />
          <Indicador titulo="Estoque baixo" valor={numero(d.estoque.estoqueBaixo)} tom="atencao" href="/produtos?filtro=baixo" />
          <Indicador titulo="Estoque zerado" valor={numero(d.estoque.estoqueZerado)} tom="critico" href="/produtos?filtro=zerado" />
        </section>
      ) : null}

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Faturamento histórico */}
        <Card className="xl:col-span-2">
          <CardHeader titulo="Faturamento" descricao="Últimos 6 meses" />
          <CardBody>
            <GraficoBarras dados={d.serieFaturamento} />
          </CardBody>
        </Card>

        {/* Funil operacional */}
        <Card>
          <CardHeader titulo="Pedidos por etapa" descricao="Fluxo operacional atual" />
          <CardBody>
            <GraficoRosca
              dados={[
                { rotulo: "Pendentes", valor: d.pedidos.pendentes, cor: "#f59e0b" },
                { rotulo: "Aprovados", valor: d.pedidos.aprovados, cor: "#1fa47a" },
                { rotulo: "Em separação", valor: d.pedidos.emSeparacao, cor: "#3b82f6" },
                { rotulo: "Faturados", valor: d.pedidos.faturados, cor: "#6366f1" },
                { rotulo: "Em transporte", valor: d.pedidos.enviados, cor: "#0ea5e9" },
                { rotulo: "Entregues", valor: d.pedidos.entregues, cor: "#0c6a51" },
              ]}
            />
          </CardBody>
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Vencimentos — alerta regulatório */}
        {verEstoque ? (
          <Card>
            <CardHeader
              titulo="Controle de validade"
              descricao="Lotes vencidos e próximos do vencimento"
              acoes={
                <Link href="/estoque" className="text-sm font-medium text-marca-700 hover:underline">
                  Ver estoque
                </Link>
              }
            />
            <Tabela>
              <thead>
                <tr>
                  <Th>Produto</Th>
                  <Th>Lote</Th>
                  <Th>Validade</Th>
                  <Th className="text-right">Qtd.</Th>
                  <Th>Situação</Th>
                </tr>
              </thead>
              <tbody>
                {[...d.estoque.listaVencidos, ...d.estoque.listaAVencer].slice(0, 8).map((l) => {
                  const dias = diasAte(l.dataValidade);
                  return (
                    <tr key={l.id}>
                      <Td className="font-medium text-tinta-900">{l.produto.nomeComercial}</Td>
                      <Td className="font-mono text-xs">{l.codigo}</Td>
                      <Td>{data(l.dataValidade)}</Td>
                      <Td className="text-right tabular-nums">{numero(l.quantidade)}</Td>
                      <Td>
                        {dias < 0 ? (
                          <Badge status="VENCIDA">Vencido há {Math.abs(dias)}d</Badge>
                        ) : dias <= DIAS_ALERTA_VALIDADE_CRITICO ? (
                          <Badge status="PENDENTE">Vence em {dias}d</Badge>
                        ) : (
                          <Badge>Vence em {dias}d</Badge>
                        )}
                      </Td>
                    </tr>
                  );
                })}
                {d.estoque.listaVencidos.length + d.estoque.listaAVencer.length === 0 ? (
                  <Vazio mensagem="Nenhum lote em alerta de validade." colSpan={5} />
                ) : null}
              </tbody>
            </Tabela>
          </Card>
        ) : null}

        {/* Ranking comercial */}
        <Card>
          <CardHeader titulo="Produtos mais vendidos" descricao="Por faturamento acumulado" />
          <Tabela>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th>SKU</Th>
                <Th className="text-right">Qtd.</Th>
                <Th className="text-right">Faturamento</Th>
              </tr>
            </thead>
            <tbody>
              {d.topProdutos.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium text-tinta-900">{p.nomeComercial}</Td>
                  <Td className="font-mono text-xs">{p.sku}</Td>
                  <Td className="text-right tabular-nums">{numero(p.quantidade)}</Td>
                  <Td className="text-right tabular-nums font-medium">{moeda(p.total)}</Td>
                </tr>
              ))}
              {d.topProdutos.length === 0 ? <Vazio mensagem="Ainda não há vendas registradas." colSpan={4} /> : null}
            </tbody>
          </Tabela>
        </Card>
      </section>

      {/* Situação operacional */}
      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {verPedidos ? (
          <Indicador titulo="Pedidos pendentes de aprovação" valor={numero(d.pedidos.pendentes)} href="/pedidos" />
        ) : null}
        <Indicador titulo="Compras pendentes" valor={numero(d.operacao.comprasPendentes)} href="/compras" />
        <Indicador titulo="Devoluções abertas" valor={numero(d.operacao.devolucoesAbertas)} href="/devolucoes" />
        <Indicador titulo="Garantias em análise" valor={numero(d.operacao.garantias)} href="/devolucoes?tipo=GARANTIA" />
      </section>
    </>
  );
}
