import Link from "next/link";
import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { data, diasAte, moeda, numero } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, Indicador, Tabela, Td, Th, TituloPagina, Vazio } from "@/components/ui";
import { GraficoBarras } from "@/components/graficos";
import { PainelTitulos, type Titulo } from "@/components/financeiro";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const sessao = await exigirPagina("financeiro");
  const { aba = "receber" } = await searchParams;

  const [contasReceber, contasPagar, clientes, fornecedores, caixa, comissoes] = await Promise.all([
    prisma.contaReceber.findMany({
      include: { cliente: { select: { razaoSocial: true } } },
      orderBy: { vencimento: "asc" },
      take: 300,
    }),
    prisma.contaPagar.findMany({
      include: { fornecedor: { select: { razaoSocial: true } } },
      orderBy: { vencimento: "asc" },
      take: 300,
    }),
    prisma.cliente.findMany({ select: { id: true, razaoSocial: true }, orderBy: { razaoSocial: "asc" } }),
    prisma.fornecedor.findMany({ select: { id: true, razaoSocial: true }, orderBy: { razaoSocial: "asc" } }),
    prisma.movimentoCaixa.findMany({ orderBy: { data: "desc" }, take: 120 }),
    prisma.comissao.findMany({
      include: { usuario: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 20,
    }),
  ]);

  const emAberto = (s: string) => ["ABERTA", "PARCIAL", "VENCIDA"].includes(s);

  const totalReceber = contasReceber.filter((c) => emAberto(c.status)).reduce((s, c) => s + (c.valor - c.valorRecebido), 0);
  const totalPagar = contasPagar.filter((c) => emAberto(c.status)).reduce((s, c) => s + (c.valor - c.valorPago), 0);
  const inadimplencia = contasReceber
    .filter((c) => emAberto(c.status) && diasAte(c.vencimento) < 0)
    .reduce((s, c) => s + (c.valor - c.valorRecebido), 0);

  const entradas = caixa.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + m.valor, 0);
  const saidas = caixa.filter((m) => m.tipo === "SAIDA").reduce((s, m) => s + m.valor, 0);

  const titulosReceber: Titulo[] = contasReceber.map((c) => ({
    id: c.id,
    descricao: c.descricao,
    valor: c.valor,
    baixado: c.valorRecebido,
    vencimento: c.vencimento,
    status: c.status,
    documento: c.documento,
    contraparte: c.cliente?.razaoSocial ?? null,
  }));

  const titulosPagar: Titulo[] = contasPagar.map((c) => ({
    id: c.id,
    descricao: c.descricao,
    valor: c.valor,
    baixado: c.valorPago,
    vencimento: c.vencimento,
    status: c.status,
    documento: c.documento,
    contraparte: c.fornecedor?.razaoSocial ?? null,
  }));

  // Projeção de caixa: saldo previsto por semana nas próximas 6 semanas.
  const projecao: { rotulo: string; valor: number }[] = [];
  for (let semana = 0; semana < 6; semana++) {
    const inicio = semana * 7;
    const fim = inicio + 7;
    const receber = contasReceber
      .filter((c) => emAberto(c.status) && diasAte(c.vencimento) >= inicio && diasAte(c.vencimento) < fim)
      .reduce((s, c) => s + (c.valor - c.valorRecebido), 0);
    const pagar = contasPagar
      .filter((c) => emAberto(c.status) && diasAte(c.vencimento) >= inicio && diasAte(c.vencimento) < fim)
      .reduce((s, c) => s + (c.valor - c.valorPago), 0);
    projecao.push({ rotulo: `S${semana + 1}`, valor: Math.max(0, receber - pagar) });
  }

  const abas = [
    { id: "receber", rotulo: "Contas a receber" },
    { id: "pagar", rotulo: "Contas a pagar" },
    { id: "caixa", rotulo: "Fluxo de caixa" },
    { id: "comissoes", rotulo: "Comissões" },
  ];

  return (
    <>
      <TituloPagina
        modulo="financeiro"
        titulo="Financeiro"
        descricao="Contas a pagar e receber, fluxo de caixa, cobrança e comissões."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="A receber" valor={moeda(totalReceber)} tom="positivo" />
        <Indicador titulo="A pagar" valor={moeda(totalPagar)} />
        <Indicador
          titulo="Saldo projetado"
          valor={moeda(totalReceber - totalPagar)}
          tom={totalReceber - totalPagar >= 0 ? "positivo" : "critico"}
        />
        <Indicador titulo="Inadimplência" valor={moeda(inadimplencia)} tom={inadimplencia > 0 ? "critico" : "neutro"} />
      </section>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-tinta-200">
        {abas.map((a) => (
          <Link
            key={a.id}
            href={`/financeiro?aba=${a.id}`}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition",
              aba === a.id
                ? "border-marca-600 text-marca-700"
                : "border-transparent text-tinta-500 hover:text-tinta-800",
            )}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {aba === "receber" ? (
          <PainelTitulos
            tipo="receber"
            titulos={JSON.parse(JSON.stringify(titulosReceber))}
            contrapartes={clientes.map((c) => ({ id: c.id, nome: c.razaoSocial }))}
            podeCriar={pode(sessao, "financeiro", "CRIAR")}
            podeBaixar={pode(sessao, "financeiro", "EDITAR")}
          />
        ) : null}

        {aba === "pagar" ? (
          <PainelTitulos
            tipo="pagar"
            titulos={JSON.parse(JSON.stringify(titulosPagar))}
            contrapartes={fornecedores.map((f) => ({ id: f.id, nome: f.razaoSocial }))}
            podeCriar={pode(sessao, "financeiro", "CRIAR")}
            podeBaixar={pode(sessao, "financeiro", "EDITAR")}
          />
        ) : null}

        {aba === "caixa" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader titulo="Projeção de caixa" descricao="Saldo líquido previsto por semana (próximas 6 semanas)" />
                <CardBody>
                  <GraficoBarras dados={projecao} />
                </CardBody>
              </Card>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <Indicador titulo="Entradas realizadas" valor={moeda(entradas)} tom="positivo" />
                <Indicador titulo="Saídas realizadas" valor={moeda(saidas)} tom="critico" />
                <Indicador titulo="Resultado" valor={moeda(entradas - saidas)} />
              </div>
            </div>

            <Card>
              <CardHeader titulo="Movimentações de caixa" descricao="Últimos lançamentos realizados" />
              <Tabela>
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Descrição</Th>
                    <Th>Origem</Th>
                    <Th>Tipo</Th>
                    <Th className="text-right">Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {caixa.map((m) => (
                    <tr key={m.id}>
                      <Td>{data(m.data)}</Td>
                      <Td className="font-medium text-tinta-900">{m.descricao}</Td>
                      <Td className="text-tinta-500">{m.origem ?? "-"}</Td>
                      <Td>
                        <Badge status={m.tipo === "ENTRADA" ? "ATIVO" : "CANCELADO"}>{m.tipo}</Badge>
                      </Td>
                      <Td
                        className={cn(
                          "text-right tabular-nums font-medium",
                          m.tipo === "ENTRADA" ? "text-marca-700" : "text-red-600",
                        )}
                      >
                        {m.tipo === "ENTRADA" ? "+" : "−"} {moeda(m.valor)}
                      </Td>
                    </tr>
                  ))}
                  {caixa.length === 0 ? <Vazio mensagem="Nenhuma movimentação registrada." colSpan={5} /> : null}
                </tbody>
              </Tabela>
            </Card>
          </div>
        ) : null}

        {aba === "comissoes" ? (
          <Card>
            <CardHeader titulo="Comissões" descricao="Geradas automaticamente no faturamento dos pedidos (3% sobre o total)" />
            <Tabela>
              <thead>
                <tr>
                  <Th>Vendedor</Th>
                  <Th>Competência</Th>
                  <Th className="text-right">Base de cálculo</Th>
                  <Th className="text-right">%</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {comissoes.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-medium text-tinta-900">{c.usuario.nome}</Td>
                    <Td className="font-mono text-xs">{c.competencia}</Td>
                    <Td className="text-right tabular-nums">{moeda(c.baseCalculo)}</Td>
                    <Td className="text-right tabular-nums">{numero(c.percentual)}%</Td>
                    <Td className="text-right tabular-nums font-medium">{moeda(c.valor)}</Td>
                    <Td>
                      <Badge status={c.status}>{c.status}</Badge>
                    </Td>
                  </tr>
                ))}
                {comissoes.length === 0 ? <Vazio mensagem="Nenhuma comissão apurada." colSpan={6} /> : null}
              </tbody>
            </Tabela>
          </Card>
        ) : null}
      </div>
    </>
  );
}
