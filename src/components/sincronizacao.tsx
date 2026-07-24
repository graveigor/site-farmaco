"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { descreverEvento, rotaAfetada } from "@/lib/eventos-mapa";
import { AREA_LABEL, type Area } from "@/lib/constants";
import { cn } from "@/lib/utils";

type UsuarioPresente = { id: string; nome: string; area: string; perfil: string };

type EventoDados = {
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

type Aviso = { id: string; texto: string; detalhes: string | null; entidade: string };

type Contexto = {
  online: UsuarioPresente[];
  conectado: boolean;
};

const SincronizacaoContexto = React.createContext<Contexto>({ online: [], conectado: false });

export const useSincronizacao = () => React.useContext(SincronizacaoContexto);

/** Espera antes de recarregar, para agrupar alterações em rajada num refresh só. */
const AGRUPAMENTO_MS = 600;
const DURACAO_AVISO_MS = 6000;

export function SincronizacaoProvider({
  usuarioId,
  children,
}: {
  usuarioId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [online, setOnline] = React.useState<UsuarioPresente[]>([]);
  const [conectado, setConectado] = React.useState(false);
  const [avisos, setAvisos] = React.useState<Aviso[]>([]);

  // Mantém o pathname atual acessível dentro do handler sem recriar a conexão
  // a cada navegação (recriar derrubaria e reabriria o SSE em toda troca de tela).
  const rotaAtual = React.useRef(pathname);
  React.useEffect(() => {
    rotaAtual.current = pathname;
  }, [pathname]);

  const agendarRefresh = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const fonte = new EventSource("/api/eventos");

    fonte.onopen = () => setConectado(true);
    fonte.onerror = () => setConectado(false); // o navegador reconecta sozinho

    fonte.addEventListener("presenca", (e) => {
      try {
        const dados = JSON.parse((e as MessageEvent).data) as { usuarios: UsuarioPresente[] };
        setOnline(dados.usuarios);
        setConectado(true);
      } catch {
        // mensagem malformada: ignora
      }
    });

    fonte.addEventListener("dados", (e) => {
      let evento: EventoDados;
      try {
        evento = JSON.parse((e as MessageEvent).data) as EventoDados;
      } catch {
        return;
      }

      const proprio = evento.usuarioId === usuarioId;
      const afeta = rotaAfetada(evento.entidade, rotaAtual.current);

      if (process.env.NODE_ENV !== "production") {
        console.debug(
          `[sync] ${evento.entidade}/${evento.acao} — rota ${rotaAtual.current} — ${afeta ? "RECARREGA" : "ignora"}`,
        );
      }

      // A tela atual mostra esse tipo de dado? Se não, não há o que recarregar.
      if (afeta) {
        if (agendarRefresh.current) clearTimeout(agendarRefresh.current);
        agendarRefresh.current = setTimeout(() => router.refresh(), AGRUPAMENTO_MS);
      }

      // Quem fez a alteração não precisa ser avisado do próprio ato.
      if (proprio) return;

      const texto = descreverEvento(evento);
      if (!texto) return;

      const aviso: Aviso = {
        id: evento.id,
        texto,
        detalhes: evento.detalhes,
        entidade: evento.entidade,
      };
      setAvisos((atuais) => [...atuais.slice(-3), aviso]);
      setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== aviso.id)), DURACAO_AVISO_MS);
    });

    return () => {
      fonte.close();
      if (agendarRefresh.current) clearTimeout(agendarRefresh.current);
    };
  }, [router, usuarioId]);

  const valor = React.useMemo(() => ({ online, conectado }), [online, conectado]);

  return (
    <SincronizacaoContexto.Provider value={valor}>
      {children}
      <PilhaDeAvisos avisos={avisos} aoFechar={(id) => setAvisos((a) => a.filter((x) => x.id !== id))} />
    </SincronizacaoContexto.Provider>
  );
}

function PilhaDeAvisos({ avisos, aoFechar }: { avisos: Aviso[]; aoFechar: (id: string) => void }) {
  if (avisos.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6"
      role="status"
      aria-live="polite"
    >
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className="pointer-events-auto w-full max-w-sm rounded-xl border border-tinta-200 bg-white p-3 shadow-lg"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-100 text-marca-700">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-tinta-900">{aviso.texto}</p>
              {aviso.detalhes ? (
                <p className="mt-0.5 truncate text-xs text-tinta-500">{aviso.detalhes}</p>
              ) : (
                <p className="mt-0.5 text-xs text-tinta-500">Esta tela foi atualizada.</p>
              )}
            </div>
            <button
              onClick={() => aoFechar(aviso.id)}
              aria-label="Dispensar"
              className="shrink-0 rounded p-0.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-700"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lista de quem está online, exibida no rodapé da sidebar. */
export function PainelPresenca({ usuarioId }: { usuarioId: string }) {
  const { online, conectado } = useSincronizacao();
  const [aberto, setAberto] = React.useState(false);

  const outros = online.filter((u) => u.id !== usuarioId);

  return (
    <div className="border-t border-white/10 px-3 py-2">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
        aria-expanded={aberto}
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            conectado ? "bg-marca-400" : "bg-amber-400",
          )}
          title={conectado ? "Sincronizado em tempo real" : "Reconectando..."}
        />
        <span className="flex-1 truncate text-xs text-tinta-400">
          {!conectado
            ? "Reconectando..."
            : outros.length === 0
              ? "Você é o único conectado"
              : `${outros.length} ${outros.length === 1 ? "colega conectado" : "colegas conectados"}`}
        </span>
        {outros.length > 0 ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cn("shrink-0 text-tinta-500 transition", aberto && "rotate-180")}
          >
            <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>

      {aberto && outros.length > 0 ? (
        <ul className="mt-1 space-y-0.5 pb-1">
          {outros.map((u) => (
            <li key={u.id} className="flex items-center gap-2 px-2 py-1">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-600/25 text-[10px] font-semibold text-marca-300">
                {u.nome
                  .split(" ")
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-tinta-300">{u.nome}</span>
                <span className="block truncate text-[10px] text-tinta-500">
                  {AREA_LABEL[u.area as Area] ?? u.area}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
