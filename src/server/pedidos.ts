import { prisma } from "@/lib/db";
import { regraNegocio, naoEncontrado } from "@/lib/api";
import { TRANSICOES_PEDIDO_VENDA, type StatusPedidoVenda } from "@/lib/constants";
import { proximoNumero } from "@/lib/utils";
import { disponivelPorProduto, liberarReserva, movimentar, reservar, sugerirLotesFEFO } from "./estoque";

/**
 * Fluxo do pedido de venda, integrando Comercial -> Logistica -> Financeiro.
 *
 * RASCUNHO -> AGUARDANDO_APROVACAO -> APROVADO (reserva estoque + cria separacao)
 *  -> EM_SEPARACAO -> CONFERIDO -> FATURADO (emite NF + gera contas a receber)
 *  -> EXPEDIDO (baixa estoque + cria entrega) -> EM_TRANSPORTE -> ENTREGUE
 */

export async function gerarNumeroPedidoVenda() {
  const ultimo = await prisma.pedidoVenda.findFirst({ orderBy: { numero: "desc" }, select: { numero: true } });
  return proximoNumero("PV", ultimo?.numero);
}

/** Regras de venda aplicadas antes de submeter o pedido para aprovacao. */
export async function validarRegrasDeVenda(pedidoId: string) {
  const pedido = await prisma.pedidoVenda.findUnique({
    where: { id: pedidoId },
    include: { cliente: true, itens: { include: { produto: true } } },
  });
  if (!pedido) throw naoEncontrado("Pedido");

  const problemas: string[] = [];

  if (pedido.cliente.bloqueado) {
    problemas.push("Cliente está bloqueado para novas vendas.");
  }

  // Limite de credito: considera o que ja esta em aberto no contas a receber.
  if (pedido.cliente.limiteCredito > 0) {
    const emAberto = await prisma.contaReceber.aggregate({
      where: { clienteId: pedido.clienteId, status: { in: ["ABERTA", "PARCIAL", "VENCIDA"] } },
      _sum: { valor: true, valorRecebido: true },
    });
    const saldoDevedor = (emAberto._sum.valor ?? 0) - (emAberto._sum.valorRecebido ?? 0);
    if (saldoDevedor + pedido.valorTotal > pedido.cliente.limiteCredito) {
      problemas.push(
        `Limite de crédito excedido (disponível: R$ ${(pedido.cliente.limiteCredito - saldoDevedor).toFixed(2)}).`,
      );
    }
  }

  // Disponibilidade de estoque item a item.
  for (const item of pedido.itens) {
    const disp = await disponivelPorProduto(item.produtoId);
    if (disp < item.quantidade) {
      problemas.push(`${item.produto.nomeComercial}: disponível ${disp}, solicitado ${item.quantidade}.`);
    }
    if (item.precoUnitario < item.produto.custoMedio) {
      problemas.push(`${item.produto.nomeComercial}: preço abaixo do custo médio.`);
    }
  }

  return problemas;
}

/** Executa a transicao de status validando o fluxo e disparando os efeitos. */
export async function transicionar(
  pedidoId: string,
  novoStatus: StatusPedidoVenda,
  usuarioId: string,
  observacoes?: string | null,
) {
  const pedido = await prisma.pedidoVenda.findUnique({
    where: { id: pedidoId },
    include: { itens: true, separacao: { include: { itens: true } } },
  });
  if (!pedido) throw naoEncontrado("Pedido");

  const atual = pedido.status as StatusPedidoVenda;
  const permitidas = TRANSICOES_PEDIDO_VENDA[atual] ?? [];
  if (!permitidas.includes(novoStatus)) {
    throw regraNegocio(`Transição inválida: ${atual} -> ${novoStatus}.`);
  }

  return prisma.$transaction(
    async (tx) => {
      switch (novoStatus) {
        case "AGUARDANDO_APROVACAO": {
          const problemas = await validarRegrasDeVenda(pedidoId);
          const bloqueantes = problemas.filter((p) => !p.includes("abaixo do custo"));
          if (bloqueantes.length) throw regraNegocio(bloqueantes.join(" "));
          break;
        }

        case "APROVADO": {
          // Reserva estoque por FEFO e abre a ordem de separacao para a Logistica.
          const separacao = await tx.separacao.create({
            data: { pedidoVendaId: pedido.id, status: "PENDENTE" },
          });

          for (const item of pedido.itens) {
            const alocacao = await reservar(tx, item.produtoId, item.quantidade);
            for (const a of alocacao) {
              await tx.itemSeparacao.create({
                data: {
                  separacaoId: separacao.id,
                  itemPedidoVendaId: item.id,
                  loteId: a.loteId,
                  quantidadeSolicitada: a.quantidade,
                  localizacao: a.localizacao,
                },
              });
            }
          }
          await tx.pedidoVenda.update({ where: { id: pedido.id }, data: { aprovadoEm: new Date() } });
          break;
        }

        case "EM_SEPARACAO": {
          await tx.separacao.update({
            where: { pedidoVendaId: pedido.id },
            data: { status: "EM_ANDAMENTO", separadorId: usuarioId, iniciadaEm: new Date() },
          });
          break;
        }

        case "CONFERIDO": {
          const sep = pedido.separacao;
          if (!sep) throw regraNegocio("Separação não iniciada.");
          const divergente = sep.itens.some((i) => i.quantidadeConferida !== i.quantidadeSolicitada);
          if (divergente) throw regraNegocio("Existem divergências na conferência. Resolva antes de prosseguir.");
          await tx.separacao.update({
            where: { id: sep.id },
            data: { status: "CONFERIDO", conferenteId: usuarioId, conferidaEm: new Date() },
          });
          break;
        }

        case "FATURADO": {
          // Emissao da nota fiscal + geracao do contas a receber (Financeiro).
          const ultimaNf = await tx.notaFiscal.findFirst({ orderBy: { numero: "desc" }, select: { numero: true } });
          const numeroNf = String(Number(ultimaNf?.numero ?? "0") + 1).padStart(6, "0");

          await tx.notaFiscal.create({
            data: {
              numero: numeroNf,
              pedidoVendaId: pedido.id,
              valorTotal: pedido.valorTotal,
              chaveAcesso: `SIM-${numeroNf}-${pedido.id.slice(-8).toUpperCase()}`,
            },
          });

          const vencimento = new Date();
          vencimento.setDate(vencimento.getDate() + (pedido.prazoDias || 30));
          await tx.contaReceber.create({
            data: {
              descricao: `Pedido ${pedido.numero} - NF ${numeroNf}`,
              clienteId: pedido.clienteId,
              pedidoVendaId: pedido.id,
              valor: pedido.valorTotal,
              vencimento,
              documento: numeroNf,
            },
          });

          // Comissao do vendedor (3% sobre o total faturado).
          if (pedido.vendedorId) {
            const percentual = 3;
            await tx.comissao.create({
              data: {
                usuarioId: pedido.vendedorId,
                pedidoVendaId: pedido.id,
                baseCalculo: pedido.valorTotal,
                percentual,
                valor: (pedido.valorTotal * percentual) / 100,
                competencia: new Date().toISOString().slice(0, 7),
              },
            });
          }

          await tx.pedidoVenda.update({ where: { id: pedido.id }, data: { faturadoEm: new Date() } });
          break;
        }

        case "EXPEDIDO": {
          // Baixa efetiva do estoque, consumindo a reserva feita na aprovacao.
          const sep = await tx.separacao.findUnique({
            where: { pedidoVendaId: pedido.id },
            include: { itens: { include: { itemPedidoVenda: true } } },
          });
          if (!sep) throw regraNegocio("Separação não encontrada.");

          for (const item of sep.itens) {
            if (!item.loteId) continue;
            await movimentar(tx, {
              produtoId: item.itemPedidoVenda.produtoId,
              loteId: item.loteId,
              quantidade: -item.quantidadeConferida,
              tipo: "SAIDA",
              origem: "PEDIDO_VENDA",
              origemId: pedido.id,
              motivo: `Expedição do pedido ${pedido.numero}`,
              usuarioId,
              consumirReserva: true,
            });
          }

          await tx.entrega.create({
            data: { pedidoVendaId: pedido.id, status: "AGUARDANDO" },
          });
          await tx.pedidoVenda.update({ where: { id: pedido.id }, data: { expedidoEm: new Date() } });
          break;
        }

        case "EM_TRANSPORTE": {
          await tx.entrega.update({
            where: { pedidoVendaId: pedido.id },
            data: { status: "EM_ROTA", saidaEm: new Date() },
          });
          break;
        }

        case "ENTREGUE": {
          await tx.entrega.update({
            where: { pedidoVendaId: pedido.id },
            data: { status: "ENTREGUE", entregueEm: new Date() },
          });
          await tx.pedidoVenda.update({ where: { id: pedido.id }, data: { entregueEm: new Date() } });
          break;
        }

        case "CANCELADO": {
          // Libera reservas se o pedido ja havia sido aprovado.
          const sep = await tx.separacao.findUnique({ where: { pedidoVendaId: pedido.id }, include: { itens: true } });
          if (sep) {
            for (const item of sep.itens) {
              if (item.loteId) await liberarReserva(tx, item.loteId, item.quantidadeSolicitada);
            }
          }
          await tx.contaReceber.updateMany({
            where: { pedidoVendaId: pedido.id, status: { in: ["ABERTA", "VENCIDA"] } },
            data: { status: "CANCELADA" },
          });
          break;
        }
      }

      return tx.pedidoVenda.update({
        where: { id: pedido.id },
        data: { status: novoStatus, ...(observacoes ? { observacoes } : {}) },
      });
    },
    { timeout: 20_000 },
  );
}

/** Consulta de disponibilidade usada pela tela de montagem do pedido. */
export async function consultarDisponibilidade(produtoId: string, quantidade: number) {
  const disponivel = await disponivelPorProduto(produtoId);
  if (disponivel < quantidade) return { disponivel, atende: false, lotes: [] };
  const lotes = await sugerirLotesFEFO(produtoId, quantidade);
  return { disponivel, atende: true, lotes };
}
