"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alerta, Badge, Botao, Campo, Card, CardHeader, Input, Select, Tabela, Td, Th, Vazio } from "./ui";
import { Modal } from "./modal";
import { rotulo, TRANSICOES_PEDIDO_COMPRA, type StatusPedidoCompra } from "@/lib/constants";
import { data, moeda, numero } from "@/lib/utils";

type Fornecedor = { id: string; razaoSocial: string };
type Produto = { id: string; nomeComercial: string; sku: string; custoMedio: number };

export type CompraView = {
  id: string;
  numero: string;
  status: string;
  valorTotal: number;
  previsaoEntrega: string | Date | null;
  fornecedor: { razaoSocial: string };
  itens: {
    id: string;
    quantidade: number;
    quantidadeRecebida: number;
    precoUnitario: number;
    produto: { nomeComercial: string; sku: string };
  }[];
};

export type Reposicao = {
  id: string;
  sku: string;
  nome: string;
  saldo: number;
  estoqueMinimo: number;
  sugestao: number;
  custoMedio: number;
  fornecedor: { id: string; razaoSocial: string } | null;
};

const ACAO_LABEL: Partial<Record<StatusPedidoCompra, string>> = {
  AGUARDANDO_APROVACAO: "Enviar para aprovação",
  APROVADO: "Aprovar",
  REJEITADO: "Rejeitar",
  CANCELADO: "Cancelar",
  RECEBIDO: "Marcar como recebido",
};

export function ComprasCliente({
  compras,
  fornecedores,
  produtos,
  reposicao,
  podeCriar,
  podeAprovar,
  podeReceber,
}: {
  compras: CompraView[];
  fornecedores: Fornecedor[];
  produtos: Produto[];
  reposicao: Reposicao[];
  podeCriar: boolean;
  podeAprovar: boolean;
  podeReceber: boolean;
}) {
  const router = useRouter();
  const [nova, setNova] = React.useState(false);
  const [recebendo, setRecebendo] = React.useState<CompraView | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [processando, setProcessando] = React.useState(false);

  async function transicionar(compra: CompraView, status: string) {
    setErro(null);
    setProcessando(true);
    try {
      const resp = await fetch(`/api/compras/${compra.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível atualizar a compra.");
        return;
      }
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

      {reposicao.length > 0 ? (
        <Card className="mb-6">
          <CardHeader
            titulo="Sugestão de reposição"
            descricao="Produtos abaixo do estoque mínimo — quantidade sugerida para atingir o nível ideal"
          />
          <Tabela>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th>Fornecedor habitual</Th>
                <Th className="text-right">Saldo</Th>
                <Th className="text-right">Mínimo</Th>
                <Th className="text-right">Sugestão</Th>
                <Th className="text-right">Custo estimado</Th>
              </tr>
            </thead>
            <tbody>
              {reposicao.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <p className="font-medium text-tinta-900">{r.nome}</p>
                    <p className="font-mono text-xs text-tinta-500">{r.sku}</p>
                  </Td>
                  <Td>{r.fornecedor?.razaoSocial ?? "-"}</Td>
                  <Td className="text-right tabular-nums font-medium text-red-600">{numero(r.saldo)}</Td>
                  <Td className="text-right tabular-nums text-tinta-500">{numero(r.estoqueMinimo)}</Td>
                  <Td className="text-right tabular-nums font-medium">{numero(r.sugestao)}</Td>
                  <Td className="text-right tabular-nums">{moeda(r.sugestao * r.custoMedio)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          titulo="Pedidos de compra"
          descricao="Da solicitação ao recebimento — o aprovado gera o contas a pagar automaticamente"
          acoes={podeCriar ? <Botao onClick={() => setNova(true)}>+ Nova compra</Botao> : null}
        />
        <Tabela>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Fornecedor</Th>
              <Th>Previsão</Th>
              <Th className="text-right">Itens</Th>
              <Th className="text-right">Valor</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => {
              const proximos = TRANSICOES_PEDIDO_COMPRA[c.status as StatusPedidoCompra] ?? [];
              const recebivel = ["APROVADO", "RECEBIDO_PARCIAL"].includes(c.status);
              return (
                <tr key={c.id} className="hover:bg-tinta-50/60">
                  <Td className="font-mono text-xs font-medium text-tinta-900">{c.numero}</Td>
                  <Td className="font-medium text-tinta-900">{c.fornecedor.razaoSocial}</Td>
                  <Td>{data(c.previsaoEntrega)}</Td>
                  <Td className="text-right tabular-nums">{c.itens.length}</Td>
                  <Td className="text-right tabular-nums font-medium">{moeda(c.valorTotal)}</Td>
                  <Td>
                    <Badge status={c.status}>{rotulo(c.status)}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {podeReceber && recebivel ? (
                        <button
                          onClick={() => setRecebendo(c)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Receber
                        </button>
                      ) : null}
                      {podeAprovar
                        ? proximos
                            .filter((s) => s !== "RECEBIDO_PARCIAL" && s !== "RECEBIDO")
                            .map((s) => (
                              <button
                                key={s}
                                onClick={() => transicionar(c, s)}
                                disabled={processando}
                                className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                                  s === "REJEITADO" || s === "CANCELADO"
                                    ? "text-red-600 hover:bg-red-50"
                                    : "text-marca-700 hover:bg-marca-50"
                                }`}
                              >
                                {ACAO_LABEL[s] ?? rotulo(s)}
                              </button>
                            ))
                        : null}
                    </div>
                  </Td>
                </tr>
              );
            })}
            {compras.length === 0 ? <Vazio mensagem="Nenhuma compra registrada." colSpan={7} /> : null}
          </tbody>
        </Tabela>
      </Card>

      {nova ? (
        <NovaCompra
          fornecedores={fornecedores}
          produtos={produtos}
          aoFechar={() => setNova(false)}
          aoSalvar={() => {
            setNova(false);
            router.refresh();
          }}
        />
      ) : null}

      {recebendo ? (
        <Recebimento
          compra={recebendo}
          aoFechar={() => setRecebendo(null)}
          aoSalvar={() => {
            setRecebendo(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function NovaCompra({
  fornecedores,
  produtos,
  aoFechar,
  aoSalvar,
}: {
  fornecedores: Fornecedor[];
  produtos: Produto[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [fornecedorId, setFornecedorId] = React.useState("");
  const [previsao, setPrevisao] = React.useState("");
  const [itens, setItens] = React.useState<{ produtoId: string; quantidade: number; precoUnitario: number }[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const total = itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);

  async function salvar() {
    setErro(null);
    if (!fornecedorId) return setErro("Selecione o fornecedor.");
    if (!itens.length) return setErro("Adicione ao menos um item.");

    setSalvando(true);
    try {
      const resp = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fornecedorId, previsaoEntrega: previsao || null, itens }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível criar a compra.");
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
      titulo="Novo pedido de compra"
      descricao="Ao ser aprovado, o título correspondente é criado no contas a pagar."
      largura="xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Criar compra"}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {erro ? <Alerta tom="erro">{erro}</Alerta> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Fornecedor" obrigatorio>
            <Select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
              <option value="">Selecione...</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.razaoSocial}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Previsão de entrega">
            <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </Campo>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-tinta-800">Itens</h3>
            <Botao
              type="button"
              variante="secundario"
              onClick={() => {
                const p = produtos[0];
                if (p) setItens((v) => [...v, { produtoId: p.id, quantidade: 1, precoUnitario: p.custoMedio }]);
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
                <Th className="text-right">Custo unit.</Th>
                <Th className="text-right">Total</Th>
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
                            i === idx ? { ...it, produtoId: e.target.value, precoUnitario: p?.custoMedio ?? it.precoUnitario } : it,
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
                  <Td className="text-right tabular-nums font-medium">{moeda(item.quantidade * item.precoUnitario)}</Td>
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
              {itens.length === 0 ? <Vazio mensagem="Nenhum item adicionado." colSpan={5} /> : null}
            </tbody>
          </Tabela>
        </div>

        <div className="flex justify-end border-t border-tinta-100 pt-4">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-tinta-500">Total da compra</p>
            <p className="text-2xl font-semibold tabular-nums text-tinta-900">{moeda(total)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Recebimento({
  compra,
  aoFechar,
  aoSalvar,
}: {
  compra: CompraView;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const pendentes = compra.itens.filter((i) => i.quantidadeRecebida < i.quantidade);
  const [dados, setDados] = React.useState<Record<string, { qtd: number; lote: string; validade: string; local: string }>>(
    Object.fromEntries(
      pendentes.map((i) => [i.id, { qtd: i.quantidade - i.quantidadeRecebida, lote: "", validade: "", local: "" }]),
    ),
  );
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    setErro(null);
    const itens = pendentes
      .map((i) => ({ item: i, d: dados[i.id] }))
      .filter(({ d }) => d && d.qtd > 0)
      .map(({ item, d }) => ({
        itemId: item.id,
        quantidadeRecebida: d.qtd,
        loteCodigo: d.lote,
        dataValidade: d.validade,
        localizacao: d.local || null,
      }));

    if (!itens.length) return setErro("Informe ao menos um item recebido.");
    if (itens.some((i) => !i.loteCodigo || !i.dataValidade)) {
      return setErro("Lote e validade são obrigatórios para todo item recebido.");
    }

    setSalvando(true);
    try {
      const resp = await fetch(`/api/compras/${compra.id}/receber`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível registrar o recebimento.");
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
      titulo="Recebimento de mercadoria"
      descricao={`${compra.numero} — ${compra.fornecedor.razaoSocial}`}
      largura="xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={salvando}>
            {salvando ? "Registrando..." : "Confirmar recebimento"}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {erro ? <Alerta tom="erro">{erro}</Alerta> : null}
        <Alerta tom="info">
          O lote e a validade são obrigatórios: são eles que permitem o rastreamento sanitário e alimentam os alertas de
          vencimento. O custo médio do produto é recalculado automaticamente.
        </Alerta>

        <Tabela>
          <thead>
            <tr>
              <Th>Produto</Th>
              <Th className="text-right">Pendente</Th>
              <Th className="text-right">Recebendo</Th>
              <Th>Lote</Th>
              <Th>Validade</Th>
              <Th>Endereço</Th>
            </tr>
          </thead>
          <tbody>
            {pendentes.map((i) => {
              const d = dados[i.id];
              return (
                <tr key={i.id}>
                  <Td>
                    <p className="font-medium text-tinta-900">{i.produto.nomeComercial}</p>
                    <p className="font-mono text-xs text-tinta-500">{i.produto.sku}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{i.quantidade - i.quantidadeRecebida}</Td>
                  <Td className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={i.quantidade - i.quantidadeRecebida}
                      value={d?.qtd ?? 0}
                      onChange={(e) => setDados((v) => ({ ...v, [i.id]: { ...v[i.id], qtd: Number(e.target.value) } }))}
                      className="w-24 text-right"
                    />
                  </Td>
                  <Td>
                    <Input
                      value={d?.lote ?? ""}
                      onChange={(e) => setDados((v) => ({ ...v, [i.id]: { ...v[i.id], lote: e.target.value } }))}
                      placeholder="L2601A"
                      className="w-28"
                    />
                  </Td>
                  <Td>
                    <Input
                      type="date"
                      value={d?.validade ?? ""}
                      onChange={(e) => setDados((v) => ({ ...v, [i.id]: { ...v[i.id], validade: e.target.value } }))}
                      className="w-40"
                    />
                  </Td>
                  <Td>
                    <Input
                      value={d?.local ?? ""}
                      onChange={(e) => setDados((v) => ({ ...v, [i.id]: { ...v[i.id], local: e.target.value } }))}
                      placeholder="RUA-A/PRAT-01"
                      className="w-36"
                    />
                  </Td>
                </tr>
              );
            })}
            {pendentes.length === 0 ? <Vazio mensagem="Todos os itens já foram recebidos." colSpan={6} /> : null}
          </tbody>
        </Tabela>
      </div>
    </Modal>
  );
}
