"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alerta, Botao, Campo, Input } from "@/components/ui";
import { AREA_LABEL, PERFIL_LABEL, type Area, type Perfil } from "@/lib/constants";
import { SENHA_DEMO, USUARIOS_DEMO } from "@/lib/demo-users";
import { Logo } from "@/components/logo";

// Atalhos de acesso rápido só existem fora de produção, para não expor
// credenciais em um ambiente publicado.
const MOSTRAR_ATALHOS = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  return (
    <React.Suspense>
      <Formulario />
    </React.Suspense>
  );
}

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const [erro, setErro] = React.useState<string | null>(null);
  const [carregando, setCarregando] = React.useState<string | null>(null);

  const entrar = React.useCallback(
    async (email: string, senha: string, chave: string) => {
      setErro(null);
      setCarregando(chave);
      try {
        const resp = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, senha }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          setErro(json.erro ?? "Não foi possível entrar.");
          return;
        }
        router.push(params.get("redirecionar") || "/dashboard");
        router.refresh();
      } catch {
        setErro("Falha de conexão com o servidor.");
      } finally {
        setCarregando(null);
      }
    },
    [router, params],
  );

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await entrar(dados.email, dados.senha, "formulario");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-tinta-950 px-4 py-10">
      <div className={`w-full ${MOSTRAR_ATALHOS ? "max-w-4xl" : "max-w-sm"}`}>
        <div className="mb-7 text-center">
          <Logo tamanho={56} className="mx-auto mb-3" />
          <h1 className="text-xl font-semibold tracking-tight text-white">Sistema Farma</h1>
          <p className="mt-1 text-sm text-tinta-400">Gestão integrada de distribuição farmacêutica</p>
        </div>

        <div className={MOSTRAR_ATALHOS ? "grid gap-5 lg:grid-cols-[20rem_1fr] lg:items-start" : ""}>
          <form onSubmit={enviar} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            {erro ? <Alerta tom="erro">{erro}</Alerta> : null}

            <Campo label="E-mail corporativo" obrigatorio>
              <Input name="email" type="email" required autoComplete="email" placeholder="nome@distribuidora.com.br" />
            </Campo>

            <Campo label="Senha" obrigatorio>
              <Input name="senha" type="password" required autoComplete="current-password" placeholder="••••••••" />
            </Campo>

            <Botao type="submit" className="w-full" disabled={carregando !== null}>
              {carregando === "formulario" ? "Entrando..." : "Entrar"}
            </Botao>
          </form>

          {MOSTRAR_ATALHOS ? (
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-white">Acesso rápido — ambiente de demonstração</h2>
                <p className="mt-0.5 text-xs text-tinta-400">
                  Clique em um usuário para entrar direto. O menu e as ações disponíveis mudam conforme a área e o
                  perfil de cada um.
                </p>
              </div>

              <ul className="grid gap-2 sm:grid-cols-2">
                {USUARIOS_DEMO.map((u) => (
                  <li key={u.email}>
                    <button
                      type="button"
                      onClick={() => entrar(u.email, SENHA_DEMO, u.email)}
                      disabled={carregando !== null}
                      className="w-full rounded-lg bg-white/5 p-3 text-left transition hover:bg-marca-600/20 hover:ring-1 hover:ring-marca-500 disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{u.nome}</p>
                          <p className="truncate text-xs text-tinta-400">{u.cargo}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-marca-600/20 px-2 py-0.5 text-[10px] font-medium text-marca-300">
                          {PERFIL_LABEL[u.perfil as Perfil]}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-[11px] text-tinta-500">{AREA_LABEL[u.area as Area]}</p>
                      {carregando === u.email ? (
                        <p className="mt-1 text-[11px] font-medium text-marca-300">Entrando...</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>

              <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-tinta-500">
                Senha de todos os usuários: <code className="font-mono text-tinta-300">{SENHA_DEMO}</code>
              </p>
            </div>
          ) : null}
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-tinta-500">
          Acesso restrito a colaboradores autorizados.
          <br />
          Todas as ações são registradas na trilha de auditoria.
        </p>
      </div>
    </main>
  );
}
