/**
 * Mapa de impacto: qual entidade afeta quais telas.
 *
 * Usado pelo cliente para decidir se um evento recebido justifica recarregar a
 * página atual. Sem isso, todo mundo recarregaria a cada alteração de qualquer
 * módulo — desperdício de rede e piscada de tela sem motivo.
 *
 * Este arquivo não importa nada do servidor: roda no navegador.
 */

export type DescricaoEntidade = {
  /** Rótulo no singular, usado nas notificações. */
  rotulo: string;
  /** Artigo para a frase ficar natural: "um cliente", "uma compra". */
  artigo: "o" | "a";
  /** Rotas que exibem dados desta entidade. */
  rotas: string[];
};

export const ENTIDADES: Record<string, DescricaoEntidade> = {
  Cliente: {
    rotulo: "cliente",
    artigo: "o",
    rotas: ["/dashboard", "/clientes", "/pedidos", "/pipeline", "/financeiro", "/devolucoes"],
  },
  Fornecedor: {
    rotulo: "fornecedor",
    artigo: "o",
    rotas: ["/dashboard", "/fornecedores", "/compras", "/produtos", "/financeiro"],
  },
  Produto: {
    rotulo: "produto",
    artigo: "o",
    rotas: ["/dashboard", "/produtos", "/estoque", "/pedidos", "/compras", "/marketing", "/devolucoes"],
  },
  PedidoVenda: {
    rotulo: "pedido de venda",
    artigo: "o",
    rotas: ["/dashboard", "/pedidos", "/logistica", "/financeiro", "/clientes"],
  },
  PedidoCompra: {
    rotulo: "pedido de compra",
    artigo: "o",
    rotas: ["/dashboard", "/compras", "/logistica", "/financeiro", "/estoque", "/produtos"],
  },
  Separacao: {
    rotulo: "separação",
    artigo: "a",
    rotas: ["/dashboard", "/logistica", "/pedidos"],
  },
  Entrega: {
    rotulo: "entrega",
    artigo: "a",
    rotas: ["/dashboard", "/logistica", "/pedidos"],
  },
  Devolucao: {
    rotulo: "devolução",
    artigo: "a",
    rotas: ["/dashboard", "/devolucoes", "/estoque", "/produtos"],
  },
  ContaPagar: {
    rotulo: "conta a pagar",
    artigo: "a",
    rotas: ["/dashboard", "/financeiro"],
  },
  ContaReceber: {
    rotulo: "conta a receber",
    artigo: "a",
    rotas: ["/dashboard", "/financeiro", "/clientes"],
  },
  Oportunidade: {
    rotulo: "oportunidade",
    artigo: "a",
    rotas: ["/dashboard", "/pipeline", "/clientes"],
  },
  Campanha: {
    rotulo: "campanha",
    artigo: "a",
    rotas: ["/dashboard", "/marketing"],
  },
  Colaborador: {
    rotulo: "colaborador",
    artigo: "o",
    rotas: ["/dashboard", "/rh"],
  },
  Usuario: {
    rotulo: "usuário",
    artigo: "o",
    rotas: ["/usuarios"],
  },
};

/** Verbo no passado para a frase da notificação. */
export const VERBOS: Record<string, string> = {
  CRIAR: "cadastrou",
  EDITAR: "atualizou",
  EXCLUIR: "excluiu",
  APROVAR: "aprovou",
  EXPORTAR: "exportou",
};

/** A rota atual exibe dados desta entidade? */
export function rotaAfetada(entidade: string, caminho: string): boolean {
  const descricao = ENTIDADES[entidade];
  if (!descricao) return false;
  return descricao.rotas.some((r) => caminho === r || caminho.startsWith(`${r}/`));
}

/** Monta a frase da notificação: "Ana cadastrou um cliente". */
export function descreverEvento(params: {
  usuarioNome: string | null;
  acao: string;
  entidade: string;
}): string | null {
  const descricao = ENTIDADES[params.entidade];
  const verbo = VERBOS[params.acao];
  if (!descricao || !verbo) return null;

  const quem = params.usuarioNome?.split(" ")[0] ?? "Alguém";
  const artigo = descricao.artigo === "a" ? "uma" : "um";
  return `${quem} ${verbo} ${artigo} ${descricao.rotulo}`;
}
