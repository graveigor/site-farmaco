import { prisma } from "@/lib/db";
import { naoEncontrado, regraNegocio } from "@/lib/api";

/**
 * Baixa (pagamento ou recebimento) de um título.
 *
 * Suporta baixa parcial: o título fica PARCIAL até que o valor total seja
 * quitado. Cada baixa gera o movimento correspondente no fluxo de caixa.
 *
 * A comparação usa tolerância de 1 centavo porque os valores são armazenados
 * em ponto flutuante — ver a ressalva sobre Decimal no README.
 */
const TOLERANCIA = 0.005;

export async function darBaixa(
  tipo: "pagar" | "receber",
  id: string,
  valor: number,
  quando: Date = new Date(),
) {
  if (valor <= 0) throw regraNegocio("Informe um valor de baixa maior que zero.");

  if (tipo === "pagar") {
    const conta = await prisma.contaPagar.findUnique({ where: { id } });
    if (!conta) throw naoEncontrado("Título");
    if (conta.status === "CANCELADA") throw regraNegocio("Título cancelado não pode receber baixa.");

    const pago = conta.valorPago + valor;
    if (pago > conta.valor + TOLERANCIA) throw regraNegocio("Valor da baixa excede o saldo do título.");

    const quitado = pago >= conta.valor - TOLERANCIA;

    return prisma.$transaction(async (tx) => {
      const atualizada = await tx.contaPagar.update({
        where: { id },
        data: { valorPago: pago, status: quitado ? "PAGA" : "PARCIAL", pagamentoEm: quitado ? quando : null },
      });
      await tx.movimentoCaixa.create({
        data: {
          tipo: "SAIDA",
          descricao: conta.descricao,
          valor,
          data: quando,
          origem: "CONTA_PAGAR",
          origemId: id,
        },
      });
      return atualizada;
    });
  }

  const conta = await prisma.contaReceber.findUnique({ where: { id } });
  if (!conta) throw naoEncontrado("Título");
  if (conta.status === "CANCELADA") throw regraNegocio("Título cancelado não pode receber baixa.");

  const recebido = conta.valorRecebido + valor;
  if (recebido > conta.valor + TOLERANCIA) throw regraNegocio("Valor da baixa excede o saldo do título.");

  const quitado = recebido >= conta.valor - TOLERANCIA;

  return prisma.$transaction(async (tx) => {
    const atualizada = await tx.contaReceber.update({
      where: { id },
      data: {
        valorRecebido: recebido,
        status: quitado ? "RECEBIDA" : "PARCIAL",
        recebimentoEm: quitado ? quando : null,
      },
    });
    await tx.movimentoCaixa.create({
      data: {
        tipo: "ENTRADA",
        descricao: conta.descricao,
        valor,
        data: quando,
        origem: "CONTA_RECEBER",
        origemId: id,
      },
    });
    return atualizada;
  });
}

/** Total em aberto (valor menos o já baixado) de títulos não quitados. */
export async function saldoEmAberto(tipo: "pagar" | "receber") {
  const emAberto = { in: ["ABERTA", "PARCIAL", "VENCIDA"] };

  if (tipo === "pagar") {
    const r = await prisma.contaPagar.aggregate({
      where: { status: emAberto },
      _sum: { valor: true, valorPago: true },
    });
    return (r._sum.valor ?? 0) - (r._sum.valorPago ?? 0);
  }

  const r = await prisma.contaReceber.aggregate({
    where: { status: emAberto },
    _sum: { valor: true, valorRecebido: true },
  });
  return (r._sum.valor ?? 0) - (r._sum.valorRecebido ?? 0);
}

/** Títulos a receber vencidos e não quitados. */
export async function inadimplencia(referencia: Date = new Date()) {
  const titulos = await prisma.contaReceber.findMany({
    where: { status: { in: ["ABERTA", "PARCIAL", "VENCIDA"] }, vencimento: { lt: referencia } },
    include: { cliente: { select: { razaoSocial: true } } },
    orderBy: { vencimento: "asc" },
  });

  return {
    titulos,
    total: titulos.reduce((s, t) => s + (t.valor - t.valorRecebido), 0),
    quantidade: titulos.length,
  };
}
