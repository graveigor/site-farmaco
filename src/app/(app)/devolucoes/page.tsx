import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { moeda, numero } from "@/lib/utils";
import { Indicador, TituloPagina } from "@/components/ui";
import { DevolucoesCliente } from "@/components/devolucoes";

export const dynamic = "force-dynamic";

export default async function DevolucoesPage() {
  const sessao = await exigirPagina("devolucoes");

  const [devolucoes, clientes, produtos] = await Promise.all([
    prisma.devolucao.findMany({
      include: {
        cliente: { select: { razaoSocial: true } },
        pedidoVenda: { select: { numero: true } },
        itens: { include: { produto: { select: { nomeComercial: true, sku: true } } } },
      },
      orderBy: { criadoEm: "desc" },
      take: 150,
    }),
    prisma.cliente.findMany({ select: { id: true, razaoSocial: true }, orderBy: { razaoSocial: "asc" } }),
    prisma.produto.findMany({
      select: { id: true, nomeComercial: true, sku: true, precoVenda: true },
      orderBy: { nomeComercial: "asc" },
    }),
  ]);

  const abertas = devolucoes.filter((d) => ["SOLICITADA", "EM_CONFERENCIA"].includes(d.status));
  const garantias = devolucoes.filter((d) => d.tipo === "GARANTIA" && !["FINALIZADA", "REJEITADA"].includes(d.status));
  const valorAberto = abertas.reduce((s, d) => s + d.valorTotal, 0);

  return (
    <>
      <TituloPagina
        modulo="devolucoes"
        titulo="Devoluções e garantias"
        descricao="Solicitação, conferência e destinação dos produtos devolvidos."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Em aberto" valor={numero(abertas.length)} tom={abertas.length ? "atencao" : "neutro"} />
        <Indicador titulo="Garantias em análise" valor={numero(garantias.length)} />
        <Indicador titulo="Valor em análise" valor={moeda(valorAberto)} />
        <Indicador titulo="Total registrado" valor={numero(devolucoes.length)} />
      </section>

      <div className="mt-6">
        <DevolucoesCliente
          devolucoes={JSON.parse(JSON.stringify(devolucoes))}
          clientes={clientes}
          produtos={produtos}
          podeCriar={pode(sessao, "devolucoes", "CRIAR")}
          podeConferir={pode(sessao, "devolucoes", "APROVAR")}
        />
      </div>
    </>
  );
}
