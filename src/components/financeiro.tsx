"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alerta, Badge, Botao, Campo, Card, CardHeader, Input, Select, Tabela, Td, Th, Vazio } from "./ui";
import { Modal } from "./modal";
import { data, diasAte, moeda } from "@/lib/utils";
import { rotulo } from "@/lib/constants";

export type Titulo = {
  id: string;
  descricao: string;
  valor: number;
  baixado: number;
  vencimento: string | Date;
  status: string;
  documento: string | null;
  contraparte: string | null;
};

/** Deriva o status visual: um título ABERTA vencido é exibido como VENCIDA. */
function statusEfetivo(t: Titulo): string {
  if (["ABERTA", "PARCIAL"].includes(t.status) && diasAte(t.vencimento) < 0) return "VENCIDA";
  return t.status;
}

export function PainelTitulos({
  tipo,
  titulos,
  contrapartes,
  podeCriar,
  podeBaixar,
}: {
  tipo: "pagar" | "receber";
  titulos: Titulo[];
  contrapartes: { id: string; nome: string }[];
  podeCriar: boolean;
  podeBaixar: boolean;
}) {
  const router = useRouter();
  const [novo, setNovo] = React.useState(false);
  const [baixando, setBaixando] = React.useState<Titulo | null>(null);
  const [filtro, setFiltro] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const lista = titulos.filter((t) => !filtro || statusEfetivo(t) === filtro);
  const rotuloTipo = tipo === "pagar" ? "pagar" : "receber";

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const payload = {
      descricao: form.descricao,
      valor: form.valor,
      vencimento: form.vencimento,
      documento: form.documento || null,
      ...(tipo === "pagar" ? { fornecedorId: form.contraparte || null } : { clienteId: form.contraparte || null }),
    };

    try {
      const resp = await fetch(`/api/financeiro/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível salvar.");
        return;
      }
      setNovo(false);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function baixar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!baixando) return;
    setErro(null);
    setSalvando(true);

    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const resp = await fetch(`/api/financeiro/${tipo}/${baixando.id}/baixa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: form.valor, data: form.data || null }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível registrar a baixa.");
        return;
      }
      setBaixando(null);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          titulo={tipo === "pagar" ? "Contas a pagar" : "Contas a receber"}
          descricao="Títulos gerados automaticamente pelos pedidos e lançamentos manuais"
          acoes={
            <div className="flex items-center gap-2">
              <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-auto">
                <option value="">Todos</option>
                <option value="ABERTA">Em aberto</option>
                <option value="PARCIAL">Parcial</option>
                <option value="VENCIDA">Vencidos</option>
                <option value={tipo === "pagar" ? "PAGA" : "RECEBIDA"}>Quitados</option>
              </Select>
              {podeCriar ? <Botao onClick={() => setNovo(true)}>+ Novo título</Botao> : null}
            </div>
          }
        />

        {erro && !novo && !baixando ? (
          <div className="p-4">
            <Alerta tom="erro">{erro}</Alerta>
          </div>
        ) : null}

        <Tabela>
          <thead>
            <tr>
              <Th>Descrição</Th>
              <Th>{tipo === "pagar" ? "Fornecedor" : "Cliente"}</Th>
              <Th>Documento</Th>
              <Th>Vencimento</Th>
              <Th className="text-right">Valor</Th>
              <Th className="text-right">Saldo</Th>
              <Th>Status</Th>
              {podeBaixar ? <Th className="text-right">Ações</Th> : null}
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => {
              const status = statusEfetivo(t);
              const saldo = t.valor - t.baixado;
              const dias = diasAte(t.vencimento);
              return (
                <tr key={t.id} className="hover:bg-tinta-50/60">
                  <Td className="font-medium text-tinta-900">{t.descricao}</Td>
                  <Td>{t.contraparte ?? "-"}</Td>
                  <Td className="font-mono text-xs">{t.documento ?? "-"}</Td>
                  <Td>
                    <span className={status === "VENCIDA" ? "font-medium text-red-600" : ""}>
                      {data(t.vencimento)}
                    </span>
                    {status === "VENCIDA" ? (
                      <p className="text-xs text-red-500">{Math.abs(dias)} dias em atraso</p>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">{moeda(t.valor)}</Td>
                  <Td className="text-right tabular-nums font-medium">{moeda(saldo)}</Td>
                  <Td>
                    <Badge status={status}>{rotulo(status)}</Badge>
                  </Td>
                  {podeBaixar ? (
                    <Td className="text-right">
                      {saldo > 0.001 && status !== "CANCELADA" ? (
                        <button
                          onClick={() => setBaixando(t)}
                          className="rounded px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50"
                        >
                          Dar baixa
                        </button>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              );
            })}
            {lista.length === 0 ? <Vazio mensagem="Nenhum título encontrado." colSpan={8} /> : null}
          </tbody>
        </Tabela>
      </Card>

      <Modal aberto={novo} aoFechar={() => setNovo(false)} titulo={`Novo título a ${rotuloTipo}`}>
        <form onSubmit={criar} className="space-y-4">
          {erro ? <Alerta tom="erro">{erro}</Alerta> : null}
          <Campo label="Descrição" obrigatorio>
            <Input name="descricao" required placeholder="Ex.: Energia elétrica — competência 07/2026" />
          </Campo>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Valor" obrigatorio>
              <Input name="valor" type="number" step="0.01" min="0.01" required />
            </Campo>
            <Campo label="Vencimento" obrigatorio>
              <Input name="vencimento" type="date" required />
            </Campo>
            <Campo label={tipo === "pagar" ? "Fornecedor" : "Cliente"}>
              <Select name="contraparte">
                <option value="">Não vinculado</option>
                {contrapartes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="Documento">
              <Input name="documento" placeholder="NF, boleto..." />
            </Campo>
          </div>
          <div className="flex justify-end gap-2 border-t border-tinta-100 pt-4">
            <Botao type="button" variante="secundario" onClick={() => setNovo(false)}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Botao>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={baixando !== null}
        aoFechar={() => setBaixando(null)}
        titulo={tipo === "pagar" ? "Registrar pagamento" : "Registrar recebimento"}
        descricao={baixando?.descricao}
        largura="sm"
      >
        {baixando ? (
          <form onSubmit={baixar} className="space-y-4">
            {erro ? <Alerta tom="erro">{erro}</Alerta> : null}
            <div className="rounded-lg bg-tinta-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-tinta-500">Valor do título</span>
                <span className="tabular-nums font-medium">{moeda(baixando.valor)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-tinta-500">Já baixado</span>
                <span className="tabular-nums">{moeda(baixando.baixado)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-tinta-200 pt-1">
                <span className="font-medium text-tinta-700">Saldo</span>
                <span className="tabular-nums font-semibold">{moeda(baixando.valor - baixando.baixado)}</span>
              </div>
            </div>
            <Campo label="Valor da baixa" obrigatorio dica="Baixas parciais são permitidas.">
              <Input
                name="valor"
                type="number"
                step="0.01"
                min="0.01"
                max={baixando.valor - baixando.baixado}
                defaultValue={(baixando.valor - baixando.baixado).toFixed(2)}
                required
              />
            </Campo>
            <Campo label="Data">
              <Input name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Campo>
            <div className="flex justify-end gap-2 border-t border-tinta-100 pt-4">
              <Botao type="button" variante="secundario" onClick={() => setBaixando(null)}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={salvando}>
                {salvando ? "Registrando..." : "Confirmar baixa"}
              </Botao>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
