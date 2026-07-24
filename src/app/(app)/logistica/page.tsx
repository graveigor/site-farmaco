import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { numero } from "@/lib/utils";
import { Indicador, TituloPagina } from "@/components/ui";
import { PainelEntregas, PainelSeparacao } from "@/components/logistica";

export const dynamic = "force-dynamic";

export default async function LogisticaPage() {
  const sessao = await exigirPagina("logistica");

  const [separacoes, entregas, recebimentosPendentes, aguardandoExpedicao] = await Promise.all([
    prisma.separacao.findMany({
      where: { status: { not: "CONFERIDO" } },
      include: {
        pedidoVenda: { include: { cliente: { select: { razaoSocial: true } } } },
        itens: {
          include: {
            lote: { select: { codigo: true, dataValidade: true } },
            itemPedidoVenda: { include: { produto: { select: { nomeComercial: true, sku: true } } } },
          },
        },
      },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.entrega.findMany({
      where: { status: { not: "ENTREGUE" } },
      include: {
        pedidoVenda: {
          include: { cliente: { select: { razaoSocial: true, cidade: true, uf: true } } },
        },
      },
      orderBy: { id: "desc" },
    }),
    prisma.pedidoCompra.count({ where: { status: { in: ["APROVADO", "RECEBIDO_PARCIAL"] } } }),
    prisma.pedidoVenda.count({ where: { status: "FATURADO" } }),
  ]);

  return (
    <>
      <TituloPagina
        modulo="logistica"
        titulo="Logística"
        descricao="Recebimento, separação, conferência, expedição e transporte."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Ordens de separação" valor={numero(separacoes.length)} tom={separacoes.length ? "atencao" : "neutro"} />
        <Indicador titulo="Aguardando expedição" valor={numero(aguardandoExpedicao)} />
        <Indicador titulo="Entregas em curso" valor={numero(entregas.length)} />
        <Indicador titulo="Recebimentos pendentes" valor={numero(recebimentosPendentes)} href="/compras" />
      </section>

      <div className="mt-6 space-y-6">
        <PainelSeparacao
          separacoes={JSON.parse(JSON.stringify(separacoes))}
          podeOperar={pode(sessao, "logistica", "EDITAR")}
          podeConferir={pode(sessao, "logistica", "APROVAR")}
        />
        <PainelEntregas
          entregas={JSON.parse(JSON.stringify(entregas))}
          podeEditar={pode(sessao, "logistica", "EDITAR")}
        />
      </div>
    </>
  );
}
