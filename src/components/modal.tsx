"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Botao } from "./ui";

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = "md",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: "sm" | "md" | "lg" | "xl";
}) {
  // Fecha com ESC e trava o scroll do corpo enquanto aberto.
  React.useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  const larguras = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta-950/40 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={aoFechar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl",
          larguras[largura],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-tinta-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-tinta-900">{titulo}</h2>
            {descricao ? <p className="mt-0.5 text-sm text-tinta-500">{descricao}</p> : null}
          </div>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg p-1 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-700"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="rolagem-fina flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {rodape ? (
          <div className="flex justify-end gap-2 border-t border-tinta-100 bg-tinta-50/60 px-5 py-3">{rodape}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Confirmacao({
  aberto,
  aoFechar,
  aoConfirmar,
  titulo,
  mensagem,
  rotuloConfirmar = "Confirmar",
  perigo = false,
  carregando = false,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
  titulo: string;
  mensagem: string;
  rotuloConfirmar?: string;
  perigo?: boolean;
  carregando?: boolean;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      largura="sm"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={carregando}>
            Cancelar
          </Botao>
          <Botao variante={perigo ? "perigo" : "primario"} onClick={aoConfirmar} disabled={carregando}>
            {carregando ? "Processando..." : rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <p className="text-sm text-tinta-600">{mensagem}</p>
    </Modal>
  );
}
