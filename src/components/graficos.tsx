import { moeda } from "@/lib/utils";

// Gráficos em SVG puro — sem dependência externa, renderizam no servidor e
// funcionam sem JavaScript no cliente.

export function GraficoBarras({
  dados,
  formato = "moeda",
  altura = 180,
}: {
  dados: { rotulo: string; valor: number }[];
  formato?: "moeda" | "numero";
  altura?: number;
}) {
  const max = Math.max(...dados.map((d) => d.valor), 1);

  return (
    <div className="flex items-end gap-2" style={{ height: altura }}>
      {dados.map((d, i) => {
        const pct = (d.valor / max) * 100;
        return (
          <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] font-medium tabular-nums text-tinta-500 opacity-0 transition group-hover:opacity-100">
              {formato === "moeda" ? moeda(d.valor) : d.valor.toLocaleString("pt-BR")}
            </span>
            <div
              className="w-full rounded-t bg-marca-500 transition group-hover:bg-marca-600"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={`${d.rotulo}: ${formato === "moeda" ? moeda(d.valor) : d.valor}`}
            />
            <span className="text-[11px] capitalize text-tinta-500">{d.rotulo}</span>
          </div>
        );
      })}
    </div>
  );
}

export function GraficoRosca({
  dados,
  tamanho = 160,
}: {
  dados: { rotulo: string; valor: number; cor: string }[];
  tamanho?: number;
}) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const raio = 60;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={tamanho} height={tamanho} viewBox="0 0 160 160" className="shrink-0 -rotate-90">
        <circle cx="80" cy="80" r={raio} fill="none" stroke="#eceef2" strokeWidth="20" />
        {total > 0 &&
          dados.map((d, i) => {
            const fracao = d.valor / total;
            const traco = fracao * circunferencia;
            const el = (
              <circle
                key={i}
                cx="80"
                cy="80"
                r={raio}
                fill="none"
                stroke={d.cor}
                strokeWidth="20"
                strokeDasharray={`${traco} ${circunferencia - traco}`}
                strokeDashoffset={-acumulado}
              />
            );
            acumulado += traco;
            return el;
          })}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {dados.map((d, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.cor }} />
              <span className="truncate text-tinta-600">{d.rotulo}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-tinta-900">{d.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barra de progresso usada em metas e ocupação de estoque. */
export function Progresso({
  valor,
  total,
  tom = "marca",
}: {
  valor: number;
  total: number;
  tom?: "marca" | "atencao" | "critico";
}) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  const cores = { marca: "bg-marca-500", atencao: "bg-amber-500", critico: "bg-red-500" } as const;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-tinta-100">
      <div className={`h-full rounded-full ${cores[tom]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
