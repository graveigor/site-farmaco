import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { TituloPagina } from "@/components/ui";
import { PedidosCliente } from "@/components/pedido-venda";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const sessao = await exigirPagina("pedidos");

  const [pedidos, clientes, produtos] = await Promise.all([
    prisma.pedidoVenda.findMany({
      include: {
        cliente: { select: { razaoSocial: true } },
        vendedor: { select: { nome: true } },
        itens: { include: { produto: { select: { nomeComercial: true } } } },
      },
      orderBy: { criadoEm: "desc" },
      take: 200,
    }),
    prisma.cliente.findMany({
      select: { id: true, razaoSocial: true, bloqueado: true, limiteCredito: true },
      orderBy: { razaoSocial: "asc" },
    }),
    prisma.produto.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nomeComercial: true, sku: true, precoVenda: true, lotes: { select: { quantidade: true, quantidadeReservada: true } } },
      orderBy: { nomeComercial: "asc" },
    }),
  ]);

  const produtosComSaldo = produtos.map((p) => ({
    id: p.id,
    nomeComercial: p.nomeComercial,
    sku: p.sku,
    precoVenda: p.precoVenda,
    saldo: p.lotes.reduce((s, l) => s + (l.quantidade - l.quantidadeReservada), 0),
  }));

  return (
    <>
      <TituloPagina
        modulo="pedidos"
        titulo="Pedidos de venda"
        descricao="Do rascunho à entrega — cada etapa valida estoque, crédito e gera os reflexos no financeiro."
      />
      <PedidosCliente
        pedidos={JSON.parse(JSON.stringify(pedidos))}
        clientes={clientes}
        produtos={produtosComSaldo}
        podeCriar={pode(sessao, "pedidos", "CRIAR")}
        podeAvancar={pode(sessao, "pedidos", "EDITAR") || pode(sessao, "logistica", "EDITAR")}
      />
    </>
  );
}
