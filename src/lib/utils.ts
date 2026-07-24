import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function moeda(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function numero(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString("pt-BR");
}

export function percentual(valor: number | null | undefined, casas = 1): string {
  return `${(valor ?? 0).toFixed(casas).replace(".", ",")}%`;
}

export function data(valor: Date | string | null | undefined): string {
  if (!valor) return "-";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function dataHora(valor: Date | string | null | undefined): string {
  if (!valor) return "-";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

/** Dias restantes ate a data (negativo quando ja passou). */
export function diasAte(valor: Date | string): number {
  const d = typeof valor === "string" ? new Date(valor) : valor;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - hoje.getTime()) / 86_400_000);
}

export function cnpjFormatado(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Valida CNPJ pelos digitos verificadores. */
export function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesoInicial: number) => {
    let peso = pesoInicial;
    let soma = 0;
    for (const ch of base) {
      soma += Number(ch) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(d.slice(0, 12), 5) === Number(d[12]) && calc(d.slice(0, 13), 6) === Number(d[13]);
}

/** Gera numeros sequenciais legiveis para documentos (PV-2026-0001). */
export function proximoNumero(prefixo: string, ultimo: string | null | undefined): string {
  const ano = new Date().getFullYear();
  const seq = ultimo?.startsWith(`${prefixo}-${ano}-`) ? Number(ultimo.split("-")[2]) + 1 : 1;
  return `${prefixo}-${ano}-${String(seq).padStart(4, "0")}`;
}
