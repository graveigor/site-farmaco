import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { sugestaoReposicao } from "@/server/compras";
import { moeda, numero } from "@/lib/utils";
import { Indicador, TituloPagina } from "@/components/ui";
import { ComprasCliente } from "@/components/compras";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  const sessao = await exigirPagina("compras");

  const [compras, fornecedores, produtos, reposicao] = await Promise.all([
    prisma.pedidoCompra.findMany({
      include: {
        fornecedor: { select: { razaoSocial: true } },
        itens: { include: { produto: { select: { nomeComercial: true, sku: true } } } },
      },
      orderBy: { criadoEm: "desc" },
      take: 100,
    }),
    prisma.fornecedor.findMany({ where: { ativo: true }, select: { id: true, razaoSocial: true }, orderBy: { razaoSocial: "asc" } }),
    prisma.produto.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nomeComercial: true, sku: true, custoMedio: true },
      orderBy: { nomeComercial: "asc" },
    }),
    sugestaoReposicao(),
  ]);

  const aguardando = compras.filter((c) => c.status === "AGUARDANDO_APROVACAO");
  const emAberto = compras.filter((c) => ["APROVADO", "RECEBIDO_PARCIAL"].includes(c.status));
  const valorEmAberto = emAberto.reduce((s, c) => s + c.valorTotal, 0);

  return (
    <>
      <TituloPagina
        modulo="compras"
        titulo="Compras e suprimentos"
        descricao="Solicitação, aprovação, recebimento e reposição de estoque."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Aguardando aprovação" valor={numero(aguardando.length)} tom={aguardando.length ? "atencao" : "neutro"} />
        <Indicador titulo="Compras em aberto" valor={numero(emAberto.length)} detalhe="aprovadas, aguardando recebimento" />
        <Indicador titulo="Valor comprometido" valor={moeda(valorEmAberto)} />
        <Indicador titulo="Itens a repor" valor={numero(reposicao.length)} tom={reposicao.length ? "critico" : "neutro"} />
      </section>

      <div className="mt-6">
        <ComprasCliente
          compras={JSON.parse(JSON.stringify(compras))}
          fornecedores={fornecedores}
          produtos={produtos}
          reposicao={JSON.parse(JSON.stringify(reposicao))}
          podeCriar={pode(sessao, "compras", "CRIAR")}
          podeAprovar={pode(sessao, "compras", "APROVAR")}
          podeReceber={pode(sessao, "logistica", "EDITAR")}
        />
      </div>
    </>
  );
}
