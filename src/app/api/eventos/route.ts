import { obterSessao } from "@/lib/auth";
import { assinar, entrar, sair, usuariosOnline, type Evento } from "@/server/eventos";

// Streaming exige renderização dinâmica e sem cache.
export const dynamic = "force-dynamic";

/** Intervalo do sinal de vida, para proxies não derrubarem a conexão ociosa. */
const BATIMENTO_MS = 25_000;

/**
 * Canal Server-Sent Events. Cada aba aberta mantém uma conexão e recebe:
 *  - `dados`: alguém alterou algo (a aba decide se recarrega);
 *  - `presenca`: mudou a lista de quem está online.
 *
 * SSE (e não WebSocket) porque o fluxo é só do servidor para o cliente, e o
 * navegador já reconecta sozinho quando a conexão cai.
 */
export async function GET(req: Request) {
  const sessao = await obterSessao();
  if (!sessao) {
    return new Response("Sessão expirada ou inexistente.", { status: 401 });
  }

  const usuario = {
    id: sessao.id,
    nome: sessao.nome,
    area: sessao.area,
    perfil: sessao.perfil,
  };

  const codificador = new TextEncoder();
  let cancelarAssinatura: (() => void) | null = null;
  let batimento: ReturnType<typeof setInterval> | null = null;
  let encerrado = false;

  const stream = new ReadableStream({
    start(controlador) {
      const enviar = (evento: Evento) => {
        if (encerrado) return;
        try {
          const nome = evento.tipo;
          controlador.enqueue(codificador.encode(`event: ${nome}\ndata: ${JSON.stringify(evento)}\n\n`));
        } catch {
          // Conexão já fechada pelo cliente; a limpeza acontece no abort.
        }
      };

      const encerrar = () => {
        if (encerrado) return;
        encerrado = true;
        cancelarAssinatura?.();
        if (batimento) clearInterval(batimento);
        sair(usuario.id);
        try {
          controlador.close();
        } catch {
          // já fechado
        }
      };

      cancelarAssinatura = assinar(enviar);
      entrar(usuario);

      // Estado inicial: quem já está online agora.
      enviar({ tipo: "presenca", usuarios: usuariosOnline() });

      batimento = setInterval(() => {
        if (encerrado) return;
        try {
          controlador.enqueue(codificador.encode(": batimento\n\n"));
        } catch {
          encerrar();
        }
      }, BATIMENTO_MS);

      req.signal.addEventListener("abort", encerrar);
    },

    cancel() {
      encerrado = true;
      cancelarAssinatura?.();
      if (batimento) clearInterval(batimento);
      sair(usuario.id);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Evita que o Nginx segure o fluxo em buffer.
      "X-Accel-Buffering": "no",
    },
  });
}
