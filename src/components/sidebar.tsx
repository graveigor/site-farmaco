"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AREA_LABEL, PERFIL_LABEL, type Modulo } from "@/lib/constants";
import type { Sessao } from "@/lib/permissions";
import { PainelPresenca } from "./sincronizacao";
import { LogoCompleta } from "./logo";

type ItemNav = { modulo: Modulo; rotulo: string; href: string; icone: string };

// Agrupado pela estrutura organizacional da distribuidora.
const GRUPOS: { titulo: string; itens: ItemNav[] }[] = [
  {
    titulo: "Visão geral",
    itens: [{ modulo: "dashboard", rotulo: "Dashboard", href: "/dashboard", icone: "M3 12h5l2-7 4 14 2-7h5" }],
  },
  {
    titulo: "Comercial",
    itens: [
      { modulo: "clientes", rotulo: "Clientes", href: "/clientes", icone: "M4 19a6 6 0 0112 0M10 9a3 3 0 100-6 3 3 0 000 6" },
      { modulo: "pipeline", rotulo: "Pipeline", href: "/pipeline", icone: "M3 5h16M6 10h10M9 15h4" },
      { modulo: "pedidos", rotulo: "Pedidos de venda", href: "/pedidos", icone: "M4 4h12v14l-6-3-6 3z" },
    ],
  },
  {
    titulo: "Suprimentos",
    itens: [
      { modulo: "produtos", rotulo: "Produtos", href: "/produtos", icone: "M4 6l6-3 6 3v8l-6 3-6-3z" },
      { modulo: "estoque", rotulo: "Estoque e lotes", href: "/estoque", icone: "M3 7h14v10H3zM3 11h14" },
      { modulo: "fornecedores", rotulo: "Fornecedores", href: "/fornecedores", icone: "M3 15V7l7-4 7 4v8M7 15v-4h6v4" },
      { modulo: "compras", rotulo: "Compras", href: "/compras", icone: "M4 5h12l-1 9H5zM7 17h.01M14 17h.01" },
    ],
  },
  {
    titulo: "Logística",
    itens: [
      { modulo: "logistica", rotulo: "Operação", href: "/logistica", icone: "M2 7h9v7H2zM11 10h4l3 3v1h-7z M5 17h.01M15 17h.01" },
      { modulo: "devolucoes", rotulo: "Devoluções e garantias", href: "/devolucoes", icone: "M4 10a6 6 0 106-6H4m0 0v4m0-4l3 3" },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [{ modulo: "financeiro", rotulo: "Financeiro", href: "/financeiro", icone: "M10 3v14M6 7h6a2 2 0 010 4H8a2 2 0 000 4h6" }],
  },
  {
    titulo: "Marketing",
    itens: [{ modulo: "marketing", rotulo: "Campanhas", href: "/marketing", icone: "M4 8v4h3l5 4V4L7 8z M15 8a3 3 0 010 4" }],
  },
  {
    titulo: "Administrativo",
    itens: [
      { modulo: "rh", rotulo: "RH / DHO", href: "/rh", icone: "M7 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 17a5 5 0 0110 0M13 9h5M13 13h5" },
      { modulo: "usuarios", rotulo: "Usuários e acessos", href: "/usuarios", icone: "M10 11a3 3 0 100-6 3 3 0 000 6zM4 18a6 6 0 0112 0" },
      { modulo: "logs", rotulo: "Auditoria", href: "/logs", icone: "M5 3h10v14H5zM8 7h4M8 10h4M8 13h2" },
    ],
  },
];

export function Sidebar({ sessao, modulos }: { sessao: Sessao; modulos: Modulo[] }) {
  const [aberto, setAberto] = React.useState(false);
  const pathname = usePathname();

  // Fecha o menu móvel ao navegar.
  React.useEffect(() => setAberto(false), [pathname]);

  const permitidos = new Set(modulos);
  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => permitidos.has(i.modulo)) })).filter(
    (g) => g.itens.length > 0,
  );

  return (
    <>
      {/* Barra superior — apenas em telas pequenas */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-tinta-200 bg-white px-4 py-3 lg:hidden">
        <Marca />
        <button
          onClick={() => setAberto((v) => !v)}
          aria-label="Alternar menu"
          aria-expanded={aberto}
          className="rounded-lg p-2 text-tinta-600 hover:bg-tinta-100"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h14M4 11h14M4 16h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {aberto ? (
        <div className="fixed inset-0 z-30 bg-tinta-950/40 lg:hidden" onClick={() => setAberto(false)} aria-hidden />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-tinta-950 text-tinta-200 transition-transform lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="hidden border-b border-white/10 px-5 py-4 lg:block">
          <Marca escura />
        </div>

        <nav className="rolagem-fina flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-tinta-500">
                {grupo.titulo}
              </p>
              <ul className="space-y-0.5">
                {grupo.itens.map((item) => {
                  const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                          ativo
                            ? "bg-marca-600 font-medium text-white"
                            : "text-tinta-300 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0"
                        >
                          <path d={item.icone} />
                        </svg>
                        {item.rotulo}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <PainelPresenca usuarioId={sessao.id} />

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-white">{sessao.nome}</p>
            <p className="truncate text-xs text-tinta-400">{PERFIL_LABEL[sessao.perfil]}</p>
            <p className="truncate text-[11px] text-tinta-500">{AREA_LABEL[sessao.area]}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-tinta-300 transition hover:bg-white/5 hover:text-white"
            >
              Sair do sistema
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function Marca({ escura = false }: { escura?: boolean }) {
  return <LogoCompleta escuro={escura} tamanho={34} />;
}
