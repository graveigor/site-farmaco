"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alerta, Badge, Botao, Campo, Card, Input, Select, Tabela, Td, Textarea, Th, Vazio } from "./ui";
import { Modal } from "./modal";
import { moeda, dataHora } from "@/lib/utils";
import { TRANSICOES_PEDIDO_VENDA, rotulo, type StatusPedidoVenda } from "@/lib/constants";

type Produto = { id: string; nomeComercial: string; sku: string; precoVenda: number; saldo: number };
type Cliente = { id: string; razaoSocial: string; bloqueado: boolean; limiteCredito: number };
export type Pedido = {
  id: string;
  numero: string;
  status: string;
  valorTotal: number;
  criadoEm: string | Date;
  cliente: { razaoSocial: string };
  vendedor: { nome: string } | null;
  itens: { id: string; quantidade: number; precoUnitario: number; total: number; produto: { nomeComercial: string } }[];
};

type ItemRascunho = { produtoId: string; quantidade: number; precoUnitario: number; desconto: number };

/** Rótulos das ações do fluxo, na perspectiva de quem executa. */
const ACAO_LABEL: Partial<Record<StatusPedidoVenda, string>> = {
  AGUARDANDO_APROVACAO: "Enviar para aprovação",
  APROVADO: "Aprovar pedido",
  EM_SEPARACAO: "Iniciar separação",
  CONFERIDO: "Confirmar conferência",
  FATURADO: "Emitir nota fiscal",
  EXPEDIDO: "Expedir",
  EM_TRANSPORTE: "Registrar saída",
  ENTREGUE: "Confirmar entrega",
  CANCELADO: "Cancelar pedido",
};

export function PedidosCliente({
  pedidos,
  clientes,
  produtos,
  podeCriar,
  podeAvancar,
}: {
  pedidos: Pedido[];
  clientes: Cliente[];
  produtos: Produto[];
  podeCriar: boolean;
  podeAvancar: boolean;
}) {
  const router = useRouter();
  const [novo, setNovo] = React.useState(false);
  const [detalhe, setDetalhe] = React.useState<Pedido | null>(null);
  const [busca, setBusca] = React.useState("");
  const [filtroStatus, setFiltroStatus] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [processando, setProcessando] = React.useState(false);

  const filtrados = pedidos.filter((p) => {
    const casaBusca =
      !busca ||
      p.numero.toLowerCase().includes(busca.toLowerCase()) ||
      p.cliente.razaoSocial.toLowerCase().includes(busca.toLowerCase());
    return casaBusca && (!filtroStatus || p.status === filtroStatus);
  });

  async function avancar(pedido: Pedido, status: string) {
    setErro(null);
    setProcessando(true);
    try {
      const resp = await fetch(`/api/pedidos/${pedido.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível avançar o pedido.");
        return;
      }
      setDetalhe(null);
      router.refresh();
    } finally {
      setProcessando(false);
    }
  }

  return (
    <>
      {erro ? (
        <div className="mb-4">
          <Alerta tom="erro">{erro}</Alerta>
        </div>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-tinta-100 p-4">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por número ou cliente..."
            className="min-w-56 flex-1"
          />
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-auto">
            <option value="">Todos os status</option>
            {Object.keys(TRANSICOES_PEDIDO_VENDA).map((s) => (
              <option key={s} value={s}>
                {rotulo(s)}
              </option>
            ))}
          </Select>
          {podeCriar ? <Botao onClick={() => setNovo(true)}>+ Novo pedido</Botao> : null}
        </div>

        <Tabela>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Cliente</Th>
              <Th>Vendedor</Th>
              <Th>Emissão</Th>
              <Th className="text-right">Itens</Th>
              <Th className="text-right">Valor</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const proximos = TRANSICOES_PEDIDO_VENDA[p.status as StatusPedidoVenda] ?? [];
              const principal = proximos.find((s) => s !== "CANCELADO");
              return (
                <tr key={p.id} className="hover:bg-tinta-50/60">
                  <Td className="font-mono text-xs font-medium text-tinta-900">{p.numero}</Td>
                  <Td className="font-medium text-tinta-900">{p.cliente.razaoSocial}</Td>
                  <Td>{p.vendedor?.nome ?? "-"}</Td>
                  <Td>{dataHora(p.criadoEm)}</Td>
                  <Td className="text-right tabular-nums">{p.itens.length}</Td>
                  <Td className="text-right tabular-nums font-medium">{moeda(p.valorTotal)}</Td>
                  <Td>
                    <Badge status={p.status}>{rotulo(p.status)}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setDetalhe(p)}
                        className="rounded px-2 py-1 text-xs font-medium text-tinta-600 hover:bg-tinta-100"
                      >
                        Detalhes
                      </button>
                      {podeAvancar && principal ? (
                        <button
                          onClick={() => avancar(p, principal)}
                          disabled={processando}
                          className="rounded px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50 disabled:opacity-50"
                        >
                          {ACAO_LABEL[principal] ?? rotulo(principal)}
                        </button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              );
            })}
            {filtrados.length === 0 ? <Vazio mensagem="Nenhum pedido encontrado." colSpan={8} /> : null}
          </tbody>
        </Tabela>
      </Card>

      {novo ? (
        <NovoPedido
          clientes={clientes}
          produtos={produtos}
          aoFechar={() => setNovo(false)}
          aoSalvar={() => {
            setNovo(false);
            router.refresh();
          }}
        />
      ) : null}

      <Modal
        aberto={detalhe !== null}
        aoFechar={() => setDetalhe(null)}
        titulo={`Pedido ${detalhe?.numero ?? ""}`}
        descricao={detalhe?.cliente.razaoSocial}
        largura="lg"
        rodape={
          detalhe && podeAvancar ? (
            <div className="flex flex-wrap gap-2">
              {(TRANSICOES_PEDIDO_VENDA[detalhe.status as StatusPedidoVenda] ?? []).map((s) => (
                <Botao
                  key={s}
                  variante={s === "CANCELADO" ? "perigo" : "primario"}
                  onClick={() => avancar(detalhe, s)}
                  disabled={processando}
                >
                  {ACAO_LABEL[s] ?? rotulo(s)}
                </Botao>
              ))}
            </div>
          ) : null
        }
      >
        {detalhe ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Badge status={detalhe.status}>{rotulo(detalhe.status)}</Badge>
              <span className="text-sm text-tinta-500">Emitido em {dataHora(detalhe.criadoEm)}</span>
            </div>
            <Tabela>
              <thead>
                <tr>
                  <Th>Produto</Th>
                  <Th className="text-right">Qtd.</Th>
                  <Th className="text-right">Unitário</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {detalhe.itens.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-medium text-tinta-900">{i.produto.nomeComercial}</Td>
                    <Td className="text-right tabular-nums">{i.quantidade}</Td>
                    <Td className="text-right tabular-nums">{moeda(i.precoUnitario)}</Td>
                    <Td className="text-right tabular-nums font-medium">{moeda(i.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
            <div className="mt-4 flex justify-end border-t border-tinta-100 pt-4">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-tinta-500">Total do pedido</p>
                <p className="text-xl font-semibold tabular-nums text-tinta-900">{moeda(detalhe.valorTotal)}</p>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}

function NovoPedido({
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
  const [clienteId, setClienteId] = React.useState("");
  const [prazoDias, setPrazoDias] = React.useState(30);
  const [observacoes, setObservacoes] = React.useState("");
  const [itens, setItens] = React.useState<ItemRascunho[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const total = itens.reduce((s, i) => s + i.quantidade * i.precoUnitario - i.desconto, 0);
  const cliente = clientes.find((c) => c.id === clienteId);

  function adicionarItem() {
    const primeiro = produtos[0];
    if (!primeiro) return;
    setItens((v) => [...v, { produtoId: primeiro.id, quantidade: 1, precoUnitario: primeiro.precoVenda, desconto: 0 }]);
  }

  function atualizarItem(idx: number, mudanca: Partial<ItemRascunho>) {
    setItens((v) =>
      v.map((item, i) => {
        if (i !== idx) return item;
        const atualizado = { ...item, ...mudanca };
        // Ao trocar o produto, puxa o preço de tabela.
        if (mudanca.produtoId) {
          const p = produtos.find((x) => x.id === mudanca.produtoId);
          if (p) atualizado.precoUnitario = p.precoVenda;
        }
        return atualizado;
      }),
    );
  }

  async function salvar() {
    setErro(null);
    if (!clienteId) return setErro("Selecione o cliente.");
    if (itens.length === 0) return setErro("Adicione ao menos um item.");

    setSalvando(true);
    try {
      const resp = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, prazoDias, observacoes, desconto: 0, itens }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível criar o pedido.");
        return;
      }
      aoSalvar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Novo pedido de venda"
      descricao="O estoque é validado na aprovação; aqui exibimos o saldo atual como referência."
      largura="xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Criar pedido"}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {erro ? <Alerta tom="erro">{erro}</Alerta> : null}
        {cliente?.bloqueado ? (
          <Alerta tom="atencao">Este cliente está bloqueado e o pedido será barrado na aprovação.</Alerta>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Cliente" obrigatorio className="sm:col-span-2">
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Selecione o cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razaoSocial}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Prazo (dias)">
            <Input type="number" min={0} value={prazoDias} onChange={(e) => setPrazoDias(Number(e.target.value))} />
          </Campo>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-tinta-800">Itens do pedido</h3>
            <Botao variante="secundario" onClick={adicionarItem} type="button">
              + Adicionar item
            </Botao>
          </div>

          <Tabela>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th className="text-right">Disponível</Th>
                <Th className="text-right">Qtd.</Th>
                <Th className="text-right">Unitário</Th>
                <Th className="text-right">Total</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => {
                const produto = produtos.find((p) => p.id === item.produtoId);
                const insuficiente = produto ? produto.saldo < item.quantidade : false;
                return (
                  <tr key={idx}>
                    <Td>
                      <Select
                        value={item.produtoId}
                        onChange={(e) => atualizarItem(idx, { produtoId: e.target.value })}
                        className="min-w-52"
                      >
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nomeComercial} ({p.sku})
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td className="text-right tabular-nums">
                      <span className={insuficiente ? "font-medium text-red-600" : "text-tinta-600"}>
                        {produto?.saldo ?? 0}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => atualizarItem(idx, { quantidade: Number(e.target.value) })}
                        className="w-20 text-right"
                      />
                    </Td>
                    <Td className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.precoUnitario}
                        onChange={(e) => atualizarItem(idx, { precoUnitario: Number(e.target.value) })}
                        className="w-28 text-right"
                      />
                    </Td>
                    <Td className="text-right tabular-nums font-medium">
                      {moeda(item.quantidade * item.precoUnitario - item.desconto)}
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
                );
              })}
              {itens.length === 0 ? <Vazio mensagem="Nenhum item adicionado." colSpan={6} /> : null}
            </tbody>
          </Tabela>
        </div>

        <Campo label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Campo>

        <div className="flex justify-end border-t border-tinta-100 pt-4">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-tinta-500">Total</p>
            <p className="text-2xl font-semibold tabular-nums text-tinta-900">{moeda(total)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
