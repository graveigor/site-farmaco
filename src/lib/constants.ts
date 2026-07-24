// Constantes de dominio compartilhadas entre servidor e cliente.
// O schema Prisma usa String nesses campos para manter portabilidade com
// SQLite; a validacao dos valores acontece aqui e nos schemas Zod.

export const AREAS = {
  DIRETORIA: "DIRETORIA",
  FINANCEIRO: "FINANCEIRO",
  SUPRIMENTOS: "SUPRIMENTOS",
  MARKETING: "MARKETING",
  COMERCIAL: "COMERCIAL",
  LOGISTICA: "LOGISTICA",
  ADMINISTRATIVO: "ADMINISTRATIVO",
} as const;
export type Area = keyof typeof AREAS;

export const AREA_LABEL: Record<Area, string> = {
  DIRETORIA: "Presidência / Diretoria / Conselho",
  FINANCEIRO: "Financeiro",
  SUPRIMENTOS: "Suprimentos",
  MARKETING: "Marketing",
  COMERCIAL: "Comercial",
  LOGISTICA: "Logística",
  ADMINISTRATIVO: "Administrativo / RH / DHO",
};

export const PERFIS = {
  ADMINISTRADOR: "ADMINISTRADOR",
  PRESIDENCIA: "PRESIDENCIA",
  DIRETORIA: "DIRETORIA",
  GERENTE: "GERENTE",
  ANALISTA: "ANALISTA",
  OPERADOR: "OPERADOR",
} as const;
export type Perfil = keyof typeof PERFIS;

export const PERFIL_LABEL: Record<Perfil, string> = {
  ADMINISTRADOR: "Administrador",
  PRESIDENCIA: "Presidência",
  DIRETORIA: "Diretoria",
  GERENTE: "Gerente",
  ANALISTA: "Analista",
  OPERADOR: "Operador",
};

export const ACOES = ["VER", "CRIAR", "EDITAR", "EXCLUIR", "APROVAR", "EXPORTAR"] as const;
export type Acao = (typeof ACOES)[number];

export const MODULOS = [
  "dashboard",
  "produtos",
  "estoque",
  "fornecedores",
  "compras",
  "clientes",
  "pipeline",
  "pedidos",
  "logistica",
  "devolucoes",
  "financeiro",
  "marketing",
  "rh",
  "usuarios",
  "logs",
  "relatorios",
] as const;
export type Modulo = (typeof MODULOS)[number];

// --- Fluxo do pedido de venda -------------------------------------------------

export const STATUS_PEDIDO_VENDA = [
  "RASCUNHO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "EM_SEPARACAO",
  "CONFERIDO",
  "FATURADO",
  "EXPEDIDO",
  "EM_TRANSPORTE",
  "ENTREGUE",
  "CANCELADO",
] as const;
export type StatusPedidoVenda = (typeof STATUS_PEDIDO_VENDA)[number];

/** Transicoes permitidas no fluxo operacional do pedido de venda. */
export const TRANSICOES_PEDIDO_VENDA: Record<StatusPedidoVenda, StatusPedidoVenda[]> = {
  RASCUNHO: ["AGUARDANDO_APROVACAO", "CANCELADO"],
  AGUARDANDO_APROVACAO: ["APROVADO", "CANCELADO"],
  APROVADO: ["EM_SEPARACAO", "CANCELADO"],
  EM_SEPARACAO: ["CONFERIDO", "CANCELADO"],
  CONFERIDO: ["FATURADO", "CANCELADO"],
  FATURADO: ["EXPEDIDO"],
  EXPEDIDO: ["EM_TRANSPORTE"],
  EM_TRANSPORTE: ["ENTREGUE"],
  ENTREGUE: [],
  CANCELADO: [],
};

export const STATUS_PEDIDO_COMPRA = [
  "RASCUNHO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "REJEITADO",
  "RECEBIDO_PARCIAL",
  "RECEBIDO",
  "CANCELADO",
] as const;
export type StatusPedidoCompra = (typeof STATUS_PEDIDO_COMPRA)[number];

export const TRANSICOES_PEDIDO_COMPRA: Record<StatusPedidoCompra, StatusPedidoCompra[]> = {
  RASCUNHO: ["AGUARDANDO_APROVACAO", "CANCELADO"],
  AGUARDANDO_APROVACAO: ["APROVADO", "REJEITADO"],
  APROVADO: ["RECEBIDO_PARCIAL", "RECEBIDO", "CANCELADO"],
  REJEITADO: [],
  RECEBIDO_PARCIAL: ["RECEBIDO"],
  RECEBIDO: [],
  CANCELADO: [],
};

export const STATUS_DEVOLUCAO = [
  "SOLICITADA",
  "EM_CONFERENCIA",
  "APROVADA",
  "REJEITADA",
  "FINALIZADA",
] as const;

export const MOTIVOS_DEVOLUCAO = [
  "AVARIA",
  "VALIDADE",
  "DIVERGENCIA",
  "DESISTENCIA",
  "TROCA",
  "DEFEITO",
] as const;

export const DESTINOS_DEVOLUCAO = ["REVENDA", "DESCARTE", "FORNECEDOR", "QUARENTENA"] as const;

export const ETAPAS_PIPELINE = [
  "PROSPECCAO",
  "QUALIFICACAO",
  "PROPOSTA",
  "NEGOCIACAO",
  "GANHA",
  "PERDIDA",
] as const;

export const STATUS_CONTA = ["ABERTA", "PARCIAL", "PAGA", "RECEBIDA", "VENCIDA", "CANCELADA"] as const;

export const STATUS_CAMPANHA = ["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"] as const;

export const STATUS_COLABORADOR = ["ATIVO", "FERIAS", "AFASTADO", "DESLIGADO"] as const;

export const UNIDADES_MEDIDA = ["UN", "CX", "FR", "AMP", "ML", "MG", "KG", "PCT"] as const;

export const SEGMENTOS_CLIENTE = [
  "FARMACIA",
  "DROGARIA",
  "HOSPITAL",
  "CLINICA",
  "REDE",
  "DISTRIBUIDOR",
] as const;

/** Dias de antecedencia usados nos alertas de validade. */
export const DIAS_ALERTA_VALIDADE = 90;
export const DIAS_ALERTA_VALIDADE_CRITICO = 30;

export function rotulo(valor: string | null | undefined): string {
  if (!valor) return "-";
  return valor
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}
