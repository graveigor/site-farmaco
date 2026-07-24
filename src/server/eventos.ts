import { EventEmitter } from "node:events";

/**
 * Barramento de eventos em memória.
 *
 * Toda alteração relevante no sistema (a mesma que já alimenta a trilha de
 * auditoria) é publicada aqui, e as sessões conectadas recebem por SSE.
 * Assim, quando alguém cadastra um cliente, as telas dos demais usuários se
 * atualizam sozinhas.
 *
 * LIMITAÇÃO IMPORTANTE: o barramento vive na memória do processo. Funciona
 * para uma única instância do servidor (o caso normal em VPS/container único).
 * Se um dia o sistema rodar com várias instâncias atrás de um balanceador,
 * troque este módulo por Redis pub/sub ou Postgres LISTEN/NOTIFY — a interface
 * pública (`publicar` / `assinar`) foi desenhada para permitir essa troca sem
 * mexer no resto do código.
 */

export type EventoDados = {
  tipo: "dados";
  id: string;
  entidade: string;
  acao: string;
  entidadeId: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
  detalhes: string | null;
  em: number;
};

export type UsuarioPresente = {
  id: string;
  nome: string;
  area: string;
  perfil: string;
};

export type EventoPresenca = {
  tipo: "presenca";
  usuarios: UsuarioPresente[];
};

export type Evento = EventoDados | EventoPresenca;

type Conexao = { usuario: UsuarioPresente; abas: number };

// Reaproveita a instância entre hot-reloads do Next em desenvolvimento.
const global = globalThis as unknown as {
  __barramento?: EventEmitter;
  __presenca?: Map<string, Conexao>;
};

const barramento =
  global.__barramento ??
  (() => {
    const e = new EventEmitter();
    // Cada aba aberta é um listener; o padrão de 10 é baixo demais.
    e.setMaxListeners(0);
    return e;
  })();

const presenca = global.__presenca ?? new Map<string, Conexao>();

if (process.env.NODE_ENV !== "production") {
  global.__barramento = barramento;
  global.__presenca = presenca;
}

const CANAL = "evento";

/** Publica uma alteração para todas as sessões conectadas. */
export function publicar(evento: Omit<EventoDados, "tipo" | "id" | "em">): void {
  const completo: EventoDados = {
    ...evento,
    tipo: "dados",
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    em: Date.now(),
  };
  barramento.emit(CANAL, completo);
}

/** Inscreve um ouvinte. Devolve a função de cancelamento. */
export function assinar(ouvinte: (evento: Evento) => void): () => void {
  barramento.on(CANAL, ouvinte);
  return () => barramento.off(CANAL, ouvinte);
}

export function usuariosOnline(): UsuarioPresente[] {
  return [...presenca.values()]
    .map((c) => c.usuario)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function anunciarPresenca(): void {
  barramento.emit(CANAL, { tipo: "presenca", usuarios: usuariosOnline() } satisfies EventoPresenca);
}

/**
 * Registra a chegada de uma aba. Um mesmo usuário pode ter várias abas abertas,
 * então contamos as conexões e só o removemos da lista quando a última fecha.
 */
export function entrar(usuario: UsuarioPresente): void {
  const atual = presenca.get(usuario.id);
  if (atual) {
    atual.abas += 1;
    return; // já estava online: não precisa reanunciar
  }
  presenca.set(usuario.id, { usuario, abas: 1 });
  anunciarPresenca();
}

export function sair(usuarioId: string): void {
  const atual = presenca.get(usuarioId);
  if (!atual) return;

  atual.abas -= 1;
  if (atual.abas > 0) return;

  presenca.delete(usuarioId);
  anunciarPresenca();
}
