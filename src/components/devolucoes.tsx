"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alerta, Badge, Botao, Campo, Card, CardHeader, Input, Select, Tabela, Td, Textarea, Th, Vazio } from "./ui";
import { Modal } from "./modal";
import { DESTINOS_DEVOLUCAO, MOTIVOS_DEVOLUCAO, rotulo } from "@/lib/constants";
import { data, moeda } from "@/lib/utils";

type Cliente = { id: string; razaoSocial: string };
type Produto = { id: string; nomeComercial: string; sku: string; precoVenda: number };

export type DevolucaoView = {
  id: string;
  numero: string;
  tipo: string;
  motivo: string;
  status: string;
  destino: string | null;
  descricao: string | null;
  valorTotal: number;
  criadoEm: string | Date;
  cliente: { razaoSocial: string };
  pedidoVenda: { numero: string } | null;
  itens: { id: string; quantidade: number; precoUnitario: number; produto: { nomeComercial: string; sku: string } }[];
};

export function DevolucoesCliente({
  devolucoes,
  clientes,
  produtos,
  podeCriar,
  podeConferir,
}: {
  devolucoes: DevolucaoView[];
  clientes: Cliente[];
  produtos: Produto[];
  podeCriar: boolean;
  podeConferir: boolean;
}) {
  const router = useRouter();
  const [nova, setNova] = React.useState(false);
  const [conferindo, setConferindo] = React.useState<DevolucaoView | null>(null);
  const [filtroTipo, setFiltroTipo] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const lista = devolucoes.filter((d) => !filtroTipo || d.tipo === filtroTipo);

  async function conferir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!conferindo) return;
    setErro(null);
    setSalvando(true);

    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const resp = await fetch(`/api/devolucoes/${conferindo.id}/conferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: form.status, destino: form.destino || null, descricao: form.descricao || null }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível registrar a conferência.");
        return;
      }
      setConferindo(null);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      {erro && !conferindo && !nova ? (
        <div className="mb-4">
          <Alerta tom="erro">{erro}</Alerta>
        </div>
      ) : null}

      <Card>
        <CardHeader
          titulo="Devoluções e garantias"
          descricao="Aprovadas com destino Revenda retornam ao estoque no lote de origem"
          acoes={
            <div className="flex items-center gap-2">
              <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-auto">
                <option value="">Todos</option>
                <option value="DEVOLUCAO">Devoluções</option>
                <option value="GARANTIA">Garantias</option>
              </Select>
              {podeCriar ? <Botao onClick={() => setNova(true)}>+ Nova solicitação</Botao> : null}
            </div>
          }
        />
        <Tabela>
          <thead>
            <tr>
              <Th>Número</Th>
              <Th>Tipo</Th>
              <Th>Cliente</Th>
              <Th>Pedido origem</Th>
              <Th>Motivo</Th>
              <Th>Data</Th>
              <Th className="text-right">Valor</Th>
              <Th>Destino</Th>
              <Th>Status</Th>
              {podeConferir ? <Th className="text-right">Ações</Th> : null}
            </tr>
          </thead>
          <tbody>
            {lista.map((d) => (
              <tr key={d.id} className="hover:bg-tinta-50/60">
                <Td className="font-mono text-xs font-medium text-tinta-900">{d.numero}</Td>
                <Td>
                  <Badge status={d.tipo === "GARANTIA" ? "EM_ANDAMENTO" : "PENDENTE"}>{rotulo(d.tipo)}</Badge>
                </Td>
                <Td className="font-medium text-tinta-900">{d.cliente.razaoSocial}</Td>
                <Td className="font-mono text-xs">{d.pedidoVenda?.numero ?? "-"}</Td>
                <Td>{rotulo(d.motivo)}</Td>
                <Td>{data(d.criadoEm)}</Td>
                <Td className="text-right tabular-nums">{moeda(d.valorTotal)}</Td>
                <Td>{d.destino ? rotulo(d.destino) : "-"}</Td>
                <Td>
                  <Badge status={d.status}>{rotulo(d.status)}</Badge>
                </Td>
                {podeConferir ? (
                  <Td className="text-right">
                    {["SOLICITADA", "EM_CONFERENCIA"].includes(d.status) ? (
                      <button
                        onClick={() => setConferindo(d)}
                        className="rounded px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50"
                      >
                        Conferir
                      </button>
                    ) : null}
                  </Td>
                ) : null}
              </tr>
            ))}
            {lista.length === 0 ? <Vazio mensagem="Nenhuma solicitação registrada." colSpan={10} /> : null}
          </tbody>
        </Tabela>
      </Card>

      {nova ? (
        <NovaDevolucao
          clientes={clientes}
          produtos={produtos}
          aoFechar={() => setNova(false)}
          aoSalvar={() => {
            setNova(false);
            router.refresh();
          }}
        />
      ) : null}

      <Modal
        aberto={conferindo !== null}
        aoFechar={() => setConferindo(null)}
        titulo="Conferência do produto devolvido"
        descricao={conferindo ? `${conferindo.numero} — ${conferindo.cliente.razaoSocial}` : undefined}
      >
        {conferindo ? (
          <form onSubmit={conferir} className="space-y-4">
            {erro ? <Alerta tom="erro">{erro}</Alerta> : null}

            <Tabela>
              <thead>
                <tr>
                  <Th>Produto</Th>
                  <Th className="text-right">Qtd.</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {conferindo.itens.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-medium text-tinta-900">{i.produto.nomeComercial}</Td>
                    <Td className="text-right tabular-nums">{i.quantidade}</Td>
                    <Td className="text-right tabular-nums">{moeda(i.quantidade * i.precoUnitario)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>

            <Campo label="Decisão" obrigatorio>
              <Select name="status" required defaultValue="APROVADA">
                <option value="APROVADA">Aprovar devolução</option>
                <option value="REJEITADA">Rejeitar devolução</option>
              </Select>
            </Campo>

            <Campo
              label="Destino do produto"
              dica="Apenas Revenda devolve o item ao estoque disponível."
            >
              <Select name="destino" defaultValue="QUARENTENA">
                {DESTINOS_DEVOLUCAO.map((d) => (
                  <option key={d} value={d}>
                    {rotulo(d)}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Parecer da conferência">
              <Textarea name="descricao" defaultValue={conferindo.descricao ?? ""} />
            </Campo>

            <div className="flex justify-end gap-2 border-t border-tinta-100 pt-4">
              <Botao type="button" variante="secundario" onClick={() => setConferindo(null)}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={salvando}>
                {salvando ? "Registrando..." : "Confirmar conferência"}
              </Botao>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}

function NovaDevolucao({
  clientes,
  produtos,
  aoFechar,
  aoSalvar,
}: {
  clientes: Cliente[];
  produtos: Produto[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [itens, setItens] = React.useState<{ produtoId: string; quantidade: number; precoUnitario: number }[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    if (!itens.length) return setErro("Adicione ao menos um item.");

    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setSalvando(true);
    try {
      const resp = await fetch("/api/devolucoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: form.clienteId,
          tipo: form.tipo,
          motivo: form.motivo,
          descricao: form.descricao || null,
          itens,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível registrar.");
        return;
      }
      aoSalvar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Nova solicitação" largura="lg">
      <form onSubmit={salvar} className="space-y-4">
        {erro ? <Alerta tom="erro">{erro}</Alerta> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Cliente" obrigatorio className="sm:col-span-2">
            <Select name="clienteId" required>
              <option value="">Selecione...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razaoSocial}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Tipo" obrigatorio>
            <Select name="tipo" defaultValue="DEVOLUCAO">
              <option value="DEVOLUCAO">Devolução</option>
              <option value="GARANTIA">Garantia</option>
            </Select>
          </Campo>
          <Campo label="Motivo" obrigatorio>
            <Select name="motivo" required>
              {MOTIVOS_DEVOLUCAO.map((m) => (
                <option key={m} value={m}>
                  {rotulo(m)}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-tinta-800">Itens devolvidos</h3>
            <Botao
              type="button"
              variante="secundario"
              onClick={() => {
                const p = produtos[0];
                if (p) setItens((v) => [...v, { produtoId: p.id, quantidade: 1, precoUnitario: p.precoVenda }]);
              }}
            >
              + Adicionar item
            </Botao>
          </div>

          <Tabela>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th className="text-right">Qtd.</Th>
                <Th className="text-right">Valor unit.</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => (
                <tr key={idx}>
                  <Td>
                    <Select
                      value={item.produtoId}
                      onChange={(e) => {
                        const p = produtos.find((x) => x.id === e.target.value);
                        setItens((v) =>
                          v.map((it, i) =>
                            i === idx ? { ...it, produtoId: e.target.value, precoUnitario: p?.precoVenda ?? it.precoUnitario } : it,
                          ),
                        );
                      }}
                      className="min-w-52"
                    >
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nomeComercial} ({p.sku})
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td className="text-right">
                    <Input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) =>
                        setItens((v) => v.map((it, i) => (i === idx ? { ...it, quantidade: Number(e.target.value) } : it)))
                      }
                      className="w-24 text-right"
                    />
                  </Td>
                  <Td className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.precoUnitario}
                      onChange={(e) =>
                        setItens((v) => v.map((it, i) => (i === idx ? { ...it, precoUnitario: Number(e.target.value) } : it)))
                      }
                      className="w-28 text-right"
                    />
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={() => setItens((v) => v.filter((_, i) => i !== idx))}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </Td>
                </tr>
              ))}
              {itens.length === 0 ? <Vazio mensagem="Nenhum item adicionado." colSpan={4} /> : null}
            </tbody>
          </Tabela>
        </div>

        <Campo label="Descrição / justificativa">
          <Textarea name="descricao" placeholder="Detalhe o ocorrido, avarias observadas, etc." />
        </Campo>

        <div className="flex justify-end gap-2 border-t border-tinta-100 pt-4">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Registrar solicitação"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
