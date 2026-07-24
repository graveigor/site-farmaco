"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alerta, Badge, Botao, Campo, Card, CardHeader, Input, Tabela, Td, Textarea, Th, Vazio } from "./ui";
import { Modal } from "./modal";
import { rotulo } from "@/lib/constants";
import { data, moeda } from "@/lib/utils";

export type SeparacaoView = {
  id: string;
  status: string;
  pedidoVenda: { id: string; numero: string; status: string; valorTotal: number; cliente: { razaoSocial: string } };
  itens: {
    id: string;
    quantidadeSolicitada: number;
    quantidadeSeparada: number;
    quantidadeConferida: number;
    localizacao: string | null;
    loteId: string | null;
    lote: { codigo: string; dataValidade: string | Date } | null;
    itemPedidoVenda: { produto: { nomeComercial: string; sku: string } };
  }[];
};

/**
 * Painel de armazém: separação (conferindo lote e endereço) e conferência
 * (validando o que sai contra o que foi pedido).
 */
export function PainelSeparacao({
  separacoes,
  podeOperar,
  podeConferir,
}: {
  separacoes: SeparacaoView[];
  podeOperar: boolean;
  podeConferir: boolean;
}) {
  const router = useRouter();
  const [ativa, setAtiva] = React.useState<SeparacaoView | null>(null);
  const [modo, setModo] = React.useState<"separar" | "conferir">("separar");
  const [quantidades, setQuantidades] = React.useState<Record<string, number>>({});
  const [observacoes, setObservacoes] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  function abrir(sep: SeparacaoView, m: "separar" | "conferir") {
    setModo(m);
    setAtiva(sep);
    setErro(null);
    setObservacoes("");
    // Pré-preenche com o solicitado — o operador ajusta apenas as divergências.
    setQuantidades(
      Object.fromEntries(
        sep.itens.map((i) => [i.id, m === "separar" ? i.quantidadeSolicitada : i.quantidadeSeparada]),
      ),
    );
  }

  async function enviar() {
    if (!ativa) return;
    setErro(null);
    setSalvando(true);

    const corpo =
      modo === "separar"
        ? {
            itens: ativa.itens.map((i) => ({
              itemSeparacaoId: i.id,
              loteId: i.loteId,
              quantidadeSeparada: quantidades[i.id] ?? 0,
            })),
          }
        : {
            itens: ativa.itens.map((i) => ({
              itemSeparacaoId: i.id,
              quantidadeConferida: quantidades[i.id] ?? 0,
            })),
            observacoes,
          };

    try {
      const resp = await fetch(`/api/logistica/separacao/${ativa.id}`, {
        method: modo === "separar" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível registrar.");
        return;
      }
      if (json.divergente) {
        setErro("Conferência registrada com divergência. O pedido não avança até ser resolvida.");
        router.refresh();
        return;
      }
      setAtiva(null);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          titulo="Ordens de separação"
          descricao="Pedidos aprovados aguardando processamento no armazém"
        />
        <Tabela>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Cliente</Th>
              <Th className="text-right">Itens</Th>
              <Th className="text-right">Valor</Th>
              <Th>Separação</Th>
              <Th>Pedido</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {separacoes.map((s) => (
              <tr key={s.id} className="hover:bg-tinta-50/60">
                <Td className="font-mono text-xs font-medium text-tinta-900">{s.pedidoVenda.numero}</Td>
                <Td className="font-medium text-tinta-900">{s.pedidoVenda.cliente.razaoSocial}</Td>
                <Td className="text-right tabular-nums">{s.itens.length}</Td>
                <Td className="text-right tabular-nums">{moeda(s.pedidoVenda.valorTotal)}</Td>
                <Td>
                  <Badge status={s.status}>{rotulo(s.status)}</Badge>
                </Td>
                <Td>
                  <Badge status={s.pedidoVenda.status}>{rotulo(s.pedidoVenda.status)}</Badge>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    {podeOperar && s.status !== "CONFERIDO" ? (
                      <button
                        onClick={() => abrir(s, "separar")}
                        className="rounded px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50"
                      >
                        Separar
                      </button>
                    ) : null}
                    {podeConferir && ["SEPARADO", "DIVERGENTE"].includes(s.status) ? (
                      <button
                        onClick={() => abrir(s, "conferir")}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Conferir
                      </button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
            {separacoes.length === 0 ? (
              <Vazio mensagem="Nenhuma ordem de separação aberta." colSpan={7} />
            ) : null}
          </tbody>
        </Tabela>
      </Card>

      <Modal
        aberto={ativa !== null}
        aoFechar={() => setAtiva(null)}
        titulo={modo === "separar" ? "Separação de pedido" : "Conferência de saída"}
        descricao={ativa ? `${ativa.pedidoVenda.numero} — ${ativa.pedidoVenda.cliente.razaoSocial}` : undefined}
        largura="lg"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAtiva(null)} disabled={salvando}>
              Fechar
            </Botao>
            <Botao onClick={enviar} disabled={salvando}>
              {salvando ? "Registrando..." : modo === "separar" ? "Finalizar separação" : "Confirmar conferência"}
            </Botao>
          </>
        }
      >
        {ativa ? (
          <div className="space-y-4">
            {erro ? <Alerta tom="atencao">{erro}</Alerta> : null}
            <Alerta tom="info">
              Lotes sugeridos por FEFO (vence primeiro, sai primeiro). Confira o endereço físico antes de coletar.
            </Alerta>

            <Tabela>
              <thead>
                <tr>
                  <Th>Produto</Th>
                  <Th>Lote</Th>
                  <Th>Validade</Th>
                  <Th>Endereço</Th>
                  <Th className="text-right">Solicitado</Th>
                  <Th className="text-right">{modo === "separar" ? "Separado" : "Conferido"}</Th>
                </tr>
              </thead>
              <tbody>
                {ativa.itens.map((i) => {
                  const valor = quantidades[i.id] ?? 0;
                  const divergente = valor !== i.quantidadeSolicitada;
                  return (
                    <tr key={i.id}>
                      <Td>
                        <p className="font-medium text-tinta-900">{i.itemPedidoVenda.produto.nomeComercial}</p>
                        <p className="font-mono text-xs text-tinta-500">{i.itemPedidoVenda.produto.sku}</p>
                      </Td>
                      <Td className="font-mono text-xs">{i.lote?.codigo ?? "-"}</Td>
                      <Td>{i.lote ? data(i.lote.dataValidade) : "-"}</Td>
                      <Td className="font-mono text-xs text-tinta-500">{i.localizacao ?? "-"}</Td>
                      <Td className="text-right tabular-nums">{i.quantidadeSolicitada}</Td>
                      <Td className="text-right">
                        <Input
                          type="number"
                          min={0}
                          value={valor}
                          onChange={(e) => setQuantidades((v) => ({ ...v, [i.id]: Number(e.target.value) }))}
                          className={`w-24 text-right ${divergente ? "border-amber-400 bg-amber-50" : ""}`}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>

            {modo === "conferir" ? (
              <Campo label="Observações da conferência">
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Registre avarias, divergências ou observações relevantes."
                />
              </Campo>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export type EntregaView = {
  id: string;
  status: string;
  transportadora: string | null;
  motorista: string | null;
  placaVeiculo: string | null;
  codigoRastreio: string | null;
  previsaoEntrega: string | Date | null;
  pedidoVenda: { numero: string; cliente: { razaoSocial: string; cidade: string | null; uf: string | null } };
};

export function PainelEntregas({ entregas, podeEditar }: { entregas: EntregaView[]; podeEditar: boolean }) {
  const router = useRouter();
  const [ativa, setAtiva] = React.useState<EntregaView | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ativa) return;
    setSalvando(true);
    setErro(null);

    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const resp = await fetch(`/api/logistica/entrega/${ativa.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível salvar.");
        return;
      }
      setAtiva(null);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader titulo="Expedição e transporte" descricao="Acompanhamento das entregas em curso" />
        <Tabela>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Destino</Th>
              <Th>Transportadora</Th>
              <Th>Rastreio</Th>
              <Th>Previsão</Th>
              <Th>Status</Th>
              {podeEditar ? <Th className="text-right">Ações</Th> : null}
            </tr>
          </thead>
          <tbody>
            {entregas.map((e) => (
              <tr key={e.id} className="hover:bg-tinta-50/60">
                <Td className="font-mono text-xs font-medium text-tinta-900">{e.pedidoVenda.numero}</Td>
                <Td>
                  <p className="font-medium text-tinta-900">{e.pedidoVenda.cliente.razaoSocial}</p>
                  <p className="text-xs text-tinta-500">
                    {e.pedidoVenda.cliente.cidade ?? "-"}/{e.pedidoVenda.cliente.uf ?? ""}
                  </p>
                </Td>
                <Td>{e.transportadora ?? "-"}</Td>
                <Td className="font-mono text-xs">{e.codigoRastreio ?? "-"}</Td>
                <Td>{data(e.previsaoEntrega)}</Td>
                <Td>
                  <Badge status={e.status}>{rotulo(e.status)}</Badge>
                </Td>
                {podeEditar ? (
                  <Td className="text-right">
                    <button
                      onClick={() => setAtiva(e)}
                      className="rounded px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50"
                    >
                      Editar
                    </button>
                  </Td>
                ) : null}
              </tr>
            ))}
            {entregas.length === 0 ? <Vazio mensagem="Nenhuma entrega em andamento." colSpan={7} /> : null}
          </tbody>
        </Tabela>
      </Card>

      <Modal
        aberto={ativa !== null}
        aoFechar={() => setAtiva(null)}
        titulo="Dados de transporte"
        descricao={ativa?.pedidoVenda.numero}
      >
        {ativa ? (
          <form onSubmit={salvar} className="space-y-4">
            {erro ? <Alerta tom="erro">{erro}</Alerta> : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Transportadora">
                <Input name="transportadora" defaultValue={ativa.transportadora ?? ""} />
              </Campo>
              <Campo label="Motorista">
                <Input name="motorista" defaultValue={ativa.motorista ?? ""} />
              </Campo>
              <Campo label="Placa do veículo">
                <Input name="placaVeiculo" defaultValue={ativa.placaVeiculo ?? ""} placeholder="ABC-1D23" />
              </Campo>
              <Campo label="Código de rastreio">
                <Input name="codigoRastreio" defaultValue={ativa.codigoRastreio ?? ""} />
              </Campo>
              <Campo label="Previsão de entrega">
                <Input
                  type="date"
                  name="previsaoEntrega"
                  defaultValue={ativa.previsaoEntrega ? new Date(ativa.previsaoEntrega).toISOString().slice(0, 10) : ""}
                />
              </Campo>
            </div>
            <div className="flex justify-end gap-2 border-t border-tinta-100 pt-4">
              <Botao type="button" variante="secundario" onClick={() => setAtiva(null)}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Botao>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
