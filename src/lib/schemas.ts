import { z } from "zod";
import {
  AREAS,
  DESTINOS_DEVOLUCAO,
  ETAPAS_PIPELINE,
  MOTIVOS_DEVOLUCAO,
  PERFIS,
  SEGMENTOS_CLIENTE,
  STATUS_CAMPANHA,
  STATUS_COLABORADOR,
  UNIDADES_MEDIDA,
} from "./constants";
import { cnpjValido } from "./utils";

const textoObrigatorio = (campo: string, min = 2) =>
  z.string().trim().min(min, `${campo} é obrigatório.`);

const cnpj = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine(cnpjValido, "CNPJ inválido.");

const dataOpcional = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

const dataObrigatoria = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Data inválida.");

const opcional = z.string().trim().optional().nullable();
const dinheiro = z.coerce.number().min(0, "Valor não pode ser negativo.");
const inteiro = z.coerce.number().int().min(0);

// --- Autenticacao -----------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  senha: z.string().min(6, "Senha deve ter ao menos 6 caracteres."),
});

// --- Usuarios ---------------------------------------------------------------

export const usuarioSchema = z.object({
  nome: textoObrigatorio("Nome"),
  email: z.string().email("E-mail inválido.").transform((v) => v.toLowerCase().trim()),
  senha: z.string().min(6, "Senha deve ter ao menos 6 caracteres.").optional(),
  cargo: opcional,
  area: z.enum(Object.keys(AREAS) as [string, ...string[]]),
  perfil: z.enum(Object.keys(PERFIS) as [string, ...string[]]),
  ativo: z.boolean().default(true),
});

// --- Produtos ---------------------------------------------------------------

export const produtoSchema = z
  .object({
    sku: textoObrigatorio("SKU"),
    nomeComercial: textoObrigatorio("Nome comercial"),
    principioAtivo: opcional,
    fabricante: opcional,
    categoria: opcional,
    codigoBarras: opcional,
    ncm: opcional,
    cest: opcional,
    unidadeMedida: z.enum(UNIDADES_MEDIDA).default("CX"),
    registroAnvisa: opcional,
    exigeReceita: z.boolean().default(false),
    controlado: z.boolean().default(false),
    estoqueMinimo: inteiro.default(0),
    estoqueMaximo: inteiro.default(0),
    custoMedio: dinheiro.default(0),
    precoVenda: dinheiro.default(0),
    status: z.enum(["ATIVO", "INATIVO", "DESCONTINUADO"]).default("ATIVO"),
    fornecedorId: opcional,
  })
  .refine((d) => d.estoqueMaximo === 0 || d.estoqueMaximo >= d.estoqueMinimo, {
    message: "Estoque máximo deve ser maior ou igual ao mínimo.",
    path: ["estoqueMaximo"],
  })
  .refine((d) => d.precoVenda === 0 || d.precoVenda >= d.custoMedio, {
    message: "Preço de venda está abaixo do custo.",
    path: ["precoVenda"],
  });

export const loteSchema = z
  .object({
    produtoId: textoObrigatorio("Produto", 1),
    codigo: textoObrigatorio("Código do lote", 1),
    dataFabricacao: dataOpcional,
    dataValidade: dataObrigatoria,
    quantidade: inteiro,
    custoUnitario: dinheiro.default(0),
    localizacao: opcional,
  })
  .refine((d) => !d.dataFabricacao || d.dataFabricacao < d.dataValidade, {
    message: "Validade deve ser posterior à fabricação.",
    path: ["dataValidade"],
  });

export const ajusteEstoqueSchema = z.object({
  loteId: textoObrigatorio("Lote", 1),
  quantidade: z.coerce.number().int(),
  motivo: textoObrigatorio("Motivo"),
});

// --- Fornecedores e clientes -------------------------------------------------

const enderecoBase = {
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")).nullable(),
  telefone: opcional,
  contatoNome: opcional,
  cep: opcional,
  logradouro: opcional,
  numero: opcional,
  bairro: opcional,
  cidade: opcional,
  uf: z.string().trim().length(2, "UF deve ter 2 letras.").optional().or(z.literal("")).nullable(),
};

export const fornecedorSchema = z.object({
  razaoSocial: textoObrigatorio("Razão social"),
  nomeFantasia: opcional,
  cnpj,
  inscricaoEstadual: opcional,
  ...enderecoBase,
  prazoEntregaDias: inteiro.default(7),
  condicaoPagamento: opcional,
  observacoes: opcional,
  ativo: z.boolean().default(true),
});

export const clienteSchema = z.object({
  razaoSocial: textoObrigatorio("Razão social"),
  nomeFantasia: opcional,
  cnpj,
  inscricaoEstadual: opcional,
  ...enderecoBase,
  segmento: z.enum(SEGMENTOS_CLIENTE).optional().nullable(),
  limiteCredito: dinheiro.default(0),
  condicaoPagamento: opcional,
  bloqueado: z.boolean().default(false),
  observacoes: opcional,
});

// --- Comercial ---------------------------------------------------------------

export const itemPedidoVendaSchema = z.object({
  produtoId: textoObrigatorio("Produto", 1),
  quantidade: z.coerce.number().int().positive("Quantidade deve ser maior que zero."),
  precoUnitario: dinheiro,
  desconto: dinheiro.default(0),
});

export const pedidoVendaSchema = z.object({
  clienteId: textoObrigatorio("Cliente", 1),
  condicaoPagamento: opcional,
  prazoDias: inteiro.default(30),
  desconto: dinheiro.default(0),
  observacoes: opcional,
  itens: z.array(itemPedidoVendaSchema).min(1, "Inclua ao menos um item no pedido."),
});

export const transicaoSchema = z.object({
  status: textoObrigatorio("Status", 1),
  observacoes: opcional,
});

export const oportunidadeSchema = z.object({
  titulo: textoObrigatorio("Título"),
  clienteId: opcional,
  prospectNome: opcional,
  etapa: z.enum(ETAPAS_PIPELINE).default("PROSPECCAO"),
  valorEstimado: dinheiro.default(0),
  probabilidade: z.coerce.number().int().min(0).max(100).default(50),
  responsavelId: opcional,
  previsaoFechamento: dataOpcional,
  motivoPerda: opcional,
});

export const interacaoSchema = z.object({
  clienteId: textoObrigatorio("Cliente", 1),
  tipo: z.enum(["LIGACAO", "EMAIL", "VISITA", "REUNIAO", "POS_VENDA"]),
  assunto: textoObrigatorio("Assunto"),
  descricao: opcional,
});

// --- Suprimentos -------------------------------------------------------------

export const itemPedidoCompraSchema = z.object({
  produtoId: textoObrigatorio("Produto", 1),
  quantidade: z.coerce.number().int().positive("Quantidade deve ser maior que zero."),
  precoUnitario: dinheiro,
});

export const pedidoCompraSchema = z.object({
  fornecedorId: textoObrigatorio("Fornecedor", 1),
  previsaoEntrega: dataOpcional,
  observacoes: opcional,
  itens: z.array(itemPedidoCompraSchema).min(1, "Inclua ao menos um item na compra."),
});

export const recebimentoSchema = z.object({
  itens: z
    .array(
      z.object({
        itemId: textoObrigatorio("Item", 1),
        quantidadeRecebida: z.coerce.number().int().positive(),
        loteCodigo: textoObrigatorio("Lote", 1),
        dataValidade: dataObrigatoria,
        localizacao: opcional,
      }),
    )
    .min(1, "Informe ao menos um item recebido."),
});

// --- Logistica ---------------------------------------------------------------

export const separacaoSchema = z.object({
  itens: z
    .array(
      z.object({
        itemSeparacaoId: textoObrigatorio("Item", 1),
        loteId: textoObrigatorio("Lote", 1),
        quantidadeSeparada: z.coerce.number().int().min(0),
      }),
    )
    .min(1),
});

export const conferenciaSchema = z.object({
  itens: z
    .array(
      z.object({
        itemSeparacaoId: textoObrigatorio("Item", 1),
        quantidadeConferida: z.coerce.number().int().min(0),
      }),
    )
    .min(1),
  observacoes: opcional,
});

export const entregaSchema = z.object({
  transportadora: opcional,
  motorista: opcional,
  placaVeiculo: opcional,
  codigoRastreio: opcional,
  previsaoEntrega: dataOpcional,
});

export const devolucaoSchema = z.object({
  clienteId: textoObrigatorio("Cliente", 1),
  pedidoVendaId: opcional,
  tipo: z.enum(["DEVOLUCAO", "GARANTIA"]).default("DEVOLUCAO"),
  motivo: z.enum(MOTIVOS_DEVOLUCAO),
  descricao: opcional,
  itens: z
    .array(
      z.object({
        produtoId: textoObrigatorio("Produto", 1),
        loteId: opcional,
        quantidade: z.coerce.number().int().positive(),
        precoUnitario: dinheiro.default(0),
      }),
    )
    .min(1, "Inclua ao menos um item."),
});

export const conferenciaDevolucaoSchema = z.object({
  status: z.enum(["APROVADA", "REJEITADA"]),
  destino: z.enum(DESTINOS_DEVOLUCAO).optional().nullable(),
  descricao: opcional,
});

// --- Financeiro --------------------------------------------------------------

export const contaPagarSchema = z.object({
  descricao: textoObrigatorio("Descrição"),
  fornecedorId: opcional,
  categoriaId: opcional,
  valor: dinheiro.refine((v) => v > 0, "Valor deve ser maior que zero."),
  vencimento: dataObrigatoria,
  documento: opcional,
  observacoes: opcional,
});

export const contaReceberSchema = z.object({
  descricao: textoObrigatorio("Descrição"),
  clienteId: opcional,
  categoriaId: opcional,
  valor: dinheiro.refine((v) => v > 0, "Valor deve ser maior que zero."),
  vencimento: dataObrigatoria,
  documento: opcional,
  observacoes: opcional,
});

export const baixaSchema = z.object({
  valor: dinheiro.refine((v) => v > 0, "Informe o valor da baixa."),
  data: dataOpcional,
  observacoes: opcional,
});

export const cobrancaSchema = z.object({
  contaReceberId: textoObrigatorio("Conta", 1),
  tipo: z.enum(["EMAIL", "TELEFONE", "CARTA", "NEGATIVACAO"]),
  descricao: opcional,
  resultado: z.enum(["PROMESSA", "SEM_CONTATO", "NEGOCIADO", "RECUSA"]).optional().nullable(),
});

// --- Marketing ---------------------------------------------------------------

export const campanhaSchema = z
  .object({
    nome: textoObrigatorio("Nome"),
    descricao: opcional,
    canal: opcional,
    publicoAlvo: opcional,
    orcamento: dinheiro.default(0),
    investido: dinheiro.default(0),
    dataInicio: dataObrigatoria,
    dataFim: dataObrigatoria,
    status: z.enum(STATUS_CAMPANHA).default("PLANEJADA"),
    resultados: opcional,
    produtoIds: z.array(z.string()).default([]),
  })
  .refine((d) => d.dataFim >= d.dataInicio, {
    message: "Data final deve ser posterior à inicial.",
    path: ["dataFim"],
  });

// --- RH / DHO ----------------------------------------------------------------

export const colaboradorSchema = z.object({
  nome: textoObrigatorio("Nome"),
  cpf: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos."),
  matricula: textoObrigatorio("Matrícula", 1),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")).nullable(),
  telefone: opcional,
  dataNascimento: dataOpcional,
  dataAdmissao: dataObrigatoria,
  dataDesligamento: dataOpcional,
  motivoDesligamento: opcional,
  salario: dinheiro.default(0),
  status: z.enum(STATUS_COLABORADOR).default("ATIVO"),
  departamentoId: opcional,
  cargoId: opcional,
});

export const documentoSchema = z.object({
  titulo: textoObrigatorio("Título"),
  tipo: z.enum(["CONTRATO", "ASO", "CERTIFICADO", "LICENCA", "POLITICA", "OUTRO"]),
  colaboradorId: opcional,
  url: opcional,
  validade: dataOpcional,
  observacoes: opcional,
});

export const treinamentoSchema = z.object({
  nome: textoObrigatorio("Nome"),
  descricao: opcional,
  cargaHoraria: inteiro.default(0),
  obrigatorio: z.boolean().default(false),
  dataInicio: dataOpcional,
  dataFim: dataOpcional,
});

export const avaliacaoSchema = z.object({
  colaboradorId: textoObrigatorio("Colaborador", 1),
  periodo: textoObrigatorio("Período", 4),
  nota: z.coerce.number().min(0).max(10),
  pontosFortes: opcional,
  pontosMelhoria: opcional,
});
