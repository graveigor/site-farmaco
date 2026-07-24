import * as React from "react";
import { cn } from "@/lib/utils";
import type { Modulo } from "@/lib/constants";
import { BotaoAjuda } from "./guia";

// Biblioteca de componentes base compartilhada por todos os módulos.

// --- Card --------------------------------------------------------------------

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-tinta-200 bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-tinta-100 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-tinta-900">{titulo}</h2>
        {descricao ? <p className="mt-0.5 text-sm text-tinta-500">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex shrink-0 items-center gap-2">{acoes}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

// --- Botão -------------------------------------------------------------------

type VarianteBotao = "primario" | "secundario" | "perigo" | "fantasma";
const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-marca-600 text-white hover:bg-marca-700 focus-visible:outline-marca-600",
  secundario: "border border-tinta-300 bg-white text-tinta-700 hover:bg-tinta-50",
  perigo: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
  fantasma: "text-tinta-600 hover:bg-tinta-100",
};

export function Botao({
  variante = "primario",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTES[variante],
        className,
      )}
      {...props}
    />
  );
}

// --- Badge de status ---------------------------------------------------------

/** Mapeia status de domínio para cores semânticas consistentes no sistema. */
const CORES_STATUS: Record<string, string> = {
  // positivos / concluídos
  ATIVO: "bg-marca-100 text-marca-800",
  APROVADO: "bg-marca-100 text-marca-800",
  APROVADA: "bg-marca-100 text-marca-800",
  ENTREGUE: "bg-marca-100 text-marca-800",
  RECEBIDO: "bg-marca-100 text-marca-800",
  RECEBIDA: "bg-marca-100 text-marca-800",
  PAGA: "bg-marca-100 text-marca-800",
  CONCLUIDA: "bg-marca-100 text-marca-800",
  GANHA: "bg-marca-100 text-marca-800",
  FINALIZADA: "bg-marca-100 text-marca-800",
  CONFERIDO: "bg-marca-100 text-marca-800",
  // em andamento
  EM_SEPARACAO: "bg-blue-100 text-blue-800",
  EM_ANDAMENTO: "bg-blue-100 text-blue-800",
  EM_TRANSPORTE: "bg-blue-100 text-blue-800",
  EM_ROTA: "bg-blue-100 text-blue-800",
  EM_CONFERENCIA: "bg-blue-100 text-blue-800",
  EXPEDIDO: "bg-blue-100 text-blue-800",
  FATURADO: "bg-blue-100 text-blue-800",
  EM_COTACAO: "bg-blue-100 text-blue-800",
  NEGOCIACAO: "bg-blue-100 text-blue-800",
  // pendentes / atenção
  AGUARDANDO_APROVACAO: "bg-amber-100 text-amber-800",
  AGUARDANDO: "bg-amber-100 text-amber-800",
  PENDENTE: "bg-amber-100 text-amber-800",
  ABERTA: "bg-amber-100 text-amber-800",
  PARCIAL: "bg-amber-100 text-amber-800",
  RECEBIDO_PARCIAL: "bg-amber-100 text-amber-800",
  SOLICITADA: "bg-amber-100 text-amber-800",
  PLANEJADA: "bg-amber-100 text-amber-800",
  FERIAS: "bg-amber-100 text-amber-800",
  // negativos
  CANCELADO: "bg-red-100 text-red-700",
  CANCELADA: "bg-red-100 text-red-700",
  REJEITADO: "bg-red-100 text-red-700",
  REJEITADA: "bg-red-100 text-red-700",
  VENCIDA: "bg-red-100 text-red-700",
  PERDIDA: "bg-red-100 text-red-700",
  DIVERGENTE: "bg-red-100 text-red-700",
  INSUCESSO: "bg-red-100 text-red-700",
  DESLIGADO: "bg-red-100 text-red-700",
  BLOQUEADO: "bg-red-100 text-red-700",
  // neutros
  RASCUNHO: "bg-tinta-100 text-tinta-700",
  INATIVO: "bg-tinta-100 text-tinta-700",
};

export function Badge({
  children,
  status,
  className,
}: {
  children: React.ReactNode;
  status?: string;
  className?: string;
}) {
  const cor = (status && CORES_STATUS[status]) || "bg-tinta-100 text-tinta-700";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        cor,
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Campos de formulário ----------------------------------------------------

export function Campo({
  label,
  erro,
  dica,
  obrigatorio,
  children,
  className,
}: {
  label: string;
  erro?: string | string[];
  dica?: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const mensagem = Array.isArray(erro) ? erro[0] : erro;
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-medium text-tinta-700">
        {label}
        {obrigatorio ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      {children}
      {mensagem ? (
        <span className="mt-1 block text-xs text-red-600">{mensagem}</span>
      ) : dica ? (
        <span className="mt-1 block text-xs text-tinta-400">{dica}</span>
      ) : null}
    </label>
  );
}

const estiloCampo =
  "w-full rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm text-tinta-900 " +
  "placeholder:text-tinta-400 focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20 " +
  "disabled:bg-tinta-50 disabled:text-tinta-500";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(estiloCampo, className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(estiloCampo, "pr-8", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} rows={3} className={cn(estiloCampo, "resize-y", className)} {...props} />;
  },
);

// --- Tabela ------------------------------------------------------------------

export function Tabela({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rolagem-fina w-full overflow-x-auto", className)}>
      <table className="w-full min-w-max text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-tinta-200 bg-tinta-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-tinta-500",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-tinta-100 px-4 py-2.5 text-tinta-700", className)} {...props} />;
}

export function Vazio({ mensagem = "Nenhum registro encontrado.", colSpan = 99 }: { mensagem?: string; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-tinta-400">
        {mensagem}
      </td>
    </tr>
  );
}

// --- Indicadores -------------------------------------------------------------

export function Indicador({
  titulo,
  valor,
  detalhe,
  variacao,
  tom = "neutro",
  href,
}: {
  titulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  variacao?: number;
  tom?: "neutro" | "positivo" | "atencao" | "critico";
  href?: string;
}) {
  const tons = {
    neutro: "border-tinta-200",
    positivo: "border-l-4 border-l-marca-500 border-tinta-200",
    atencao: "border-l-4 border-l-amber-500 border-tinta-200",
    critico: "border-l-4 border-l-red-500 border-tinta-200",
  } as const;

  const conteudo = (
    <div className={cn("h-full rounded-xl border bg-white p-4 shadow-sm transition", tons[tom], href && "hover:shadow-md")}>
      <p className="text-xs font-medium uppercase tracking-wide text-tinta-500">{titulo}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-tinta-900">{valor}</p>
      <div className="mt-1 flex items-center gap-2">
        {typeof variacao === "number" && Number.isFinite(variacao) ? (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              variacao >= 0 ? "text-marca-700" : "text-red-600",
            )}
          >
            {variacao >= 0 ? "▲" : "▼"} {Math.abs(variacao).toFixed(1).replace(".", ",")}%
          </span>
        ) : null}
        {detalhe ? <span className="text-xs text-tinta-500">{detalhe}</span> : null}
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="block h-full">
      {conteudo}
    </a>
  ) : (
    conteudo
  );
}

// --- Feedback ----------------------------------------------------------------

export function Alerta({
  tom = "info",
  children,
  className,
}: {
  tom?: "info" | "sucesso" | "atencao" | "erro";
  children: React.ReactNode;
  className?: string;
}) {
  const tons = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    sucesso: "bg-marca-50 text-marca-800 border-marca-200",
    atencao: "bg-amber-50 text-amber-800 border-amber-200",
    erro: "bg-red-50 text-red-700 border-red-200",
  } as const;
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", tons[tom], className)} role="alert">
      {children}
    </div>
  );
}

export function TituloPagina({
  titulo,
  descricao,
  acoes,
  modulo,
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
  /** Quando informado, exibe o botão "Como funciona" com o guia da tela. */
  modulo?: Modulo;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-tinta-900 sm:text-2xl">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-tinta-500">{descricao}</p> : null}
      </div>
      {acoes || modulo ? (
        <div className="flex items-center gap-2">
          {acoes}
          {modulo ? <BotaoAjuda modulo={modulo} /> : null}
        </div>
      ) : null}
    </div>
  );
}
