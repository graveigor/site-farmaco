import { cn } from "@/lib/utils";

/**
 * Marca do Sistema Farma.
 *
 * Conceito: um hexágono — forma que remete tanto à estrutura molecular quanto
 * à célula de uma cartela de blister — envolvendo a cruz da saúde. O recorte da
 * cruz é vazado, então a marca continua legível em 24px (favicon) e em 48px
 * (tela de login).
 *
 * O símbolo traz o próprio fundo, o que permite usá-lo isolado sobre qualquer
 * superfície, clara ou escura.
 */
export function Logo({ className, tamanho = 40 }: { className?: string; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Sistema Farma"
    >
      <defs>
        <linearGradient id="marcaFundo" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1FA47A" />
          <stop offset="1" stopColor="#0B4537" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="11" fill="url(#marcaFundo)" />

      {/* Hexágono + cruz vazada, desenhados como um caminho só com regra
          evenodd: a cruz vira recorte e deixa o gradiente aparecer.
          As proporções são generosas de propósito — braço da cruz e anel do
          hexágono com ~5 unidades — para o desenho não empastar em 16px. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20 7.4 L30.9 13.7 V26.3 L20 32.6 L9.1 26.3 V13.7 Z
           M17.4 12.8 V17.4 H12.8 V22.6 H17.4 V27.2 H22.6 V22.6 H27.2 V17.4 H22.6 V12.8 Z"
        fill="white"
      />
    </svg>
  );
}

/** Marca + nome, para cabeçalhos. `escuro` inverte a cor do texto. */
export function LogoCompleta({
  escuro = false,
  tamanho = 34,
  className,
}: {
  escuro?: boolean;
  tamanho?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo tamanho={tamanho} />
      <div className="leading-tight">
        <p className={cn("text-sm font-semibold tracking-tight", escuro ? "text-white" : "text-tinta-900")}>
          Sistema Farma
        </p>
        <p className="text-[11px] text-tinta-400">Gestão de distribuição</p>
      </div>
    </div>
  );
}
