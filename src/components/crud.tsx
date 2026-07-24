"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alerta, Badge, Botao, Campo, Card, Input, Select, Tabela, Td, Textarea, Th, Vazio } from "./ui";
import { Confirmacao, Modal } from "./modal";
import { moeda, data as fmtData } from "@/lib/utils";

export type TipoCampo = "texto" | "numero" | "moeda" | "data" | "select" | "textarea" | "checkbox";

export type CampoConfig = {
  nome: string;
  label: string;
  tipo?: TipoCampo;
  opcoes?: { valor: string; rotulo: string }[];
  obrigatorio?: boolean;
  dica?: string;
  placeholder?: string;
  /** Ocupa a linha inteira no grid do formulário. */
  largo?: boolean;
  /** Não aparece no formulário de edição (ex.: senha em alguns fluxos). */
  somenteCriacao?: boolean;
  padrao?: string | number | boolean;
};

export type Formato =
  | "texto"
  | "mono"
  | "moeda"
  | "numero"
  | "percentual"
  | "data"
  | "status"
  | "badge";

/**
 * Colunas são declarativas (e não funções de render) porque este é um Client
 * Component: funções não atravessam a fronteira servidor→cliente. O `chave`
 * aceita caminho aninhado, ex.: "cliente.razaoSocial".
 */
export type ColunaConfig = {
  chave: string;
  label: string;
  formato?: Formato;
  alinhamento?: "esquerda" | "direita";
  /** Segunda linha, menor, abaixo do valor principal. */
  sub?: string;
  subFormato?: Formato;
  /** Prefixo textual da segunda linha, ex.: "Matrícula ". */
  subPrefixo?: string;
  /** Texto exibido quando o valor é vazio/nulo. */
  vazio?: string;
  /**
   * Realce condicional para valores numéricos, comparando com outro campo:
   * zero fica crítico, menor ou igual ao limite fica em atenção.
   */
  realce?: { limite: string };
  /** Renderiza booleano como badge com rótulos e cores próprios. */
  booleano?: { verdadeiro: string; falso: string; statusVerdadeiro: string; statusFalso: string };
};

/** Lê valor por caminho aninhado ("cliente.razaoSocial"). */
function valorEm(registro: unknown, caminho: string): unknown {
  return caminho.split(".").reduce<unknown>((atual, parte) => {
    if (atual === null || atual === undefined || typeof atual !== "object") return undefined;
    return (atual as Record<string, unknown>)[parte];
  }, registro);
}

function formatar(valor: unknown, formato: Formato = "texto", vazio = "-"): React.ReactNode {
  if (valor === null || valor === undefined || valor === "") return vazio;

  switch (formato) {
    case "moeda":
      return moeda(Number(valor));
    case "numero":
      return Number(valor).toLocaleString("pt-BR");
    case "percentual":
      return `${Number(valor).toFixed(1).replace(".", ",")}%`;
    case "data":
      return fmtData(valor as string);
    case "status":
      return <Badge status={String(valor)}>{String(valor).replace(/_/g, " ")}</Badge>;
    case "badge":
      return <Badge>{String(valor).replace(/_/g, " ")}</Badge>;
    case "mono":
      return <span className="font-mono text-xs">{String(valor)}</span>;
    default:
      return String(valor);
  }
}

function Celula({ registro, coluna }: { registro: Record<string, unknown>; coluna: ColunaConfig }) {
  if (coluna.booleano) {
    const v = Boolean(valorEm(registro, coluna.chave));
    return (
      <Badge status={v ? coluna.booleano.statusVerdadeiro : coluna.booleano.statusFalso}>
        {v ? coluna.booleano.verdadeiro : coluna.booleano.falso}
      </Badge>
    );
  }

  const valor = valorEm(registro, coluna.chave);
  const principal = formatar(valor, coluna.formato, coluna.vazio);

  // Realce: destaca saldos zerados ou abaixo do limite configurado.
  let classe = "";
  if (coluna.realce) {
    const n = Number(valor);
    const limite = Number(valorEm(registro, coluna.realce.limite) ?? 0);
    if (n === 0) classe = "font-medium text-red-600";
    else if (n <= limite) classe = "font-medium text-amber-600";
  }

  if (!coluna.sub) {
    return classe ? <span className={classe}>{principal}</span> : <>{principal}</>;
  }

  const sub = valorEm(registro, coluna.sub);
  return (
    <div>
      <p className={classe || "font-medium text-tinta-900"}>{principal}</p>
      {sub !== null && sub !== undefined && sub !== "" ? (
        <p className="text-xs text-tinta-500">
          {coluna.subPrefixo}
          {coluna.subFormato === "mono" ? (
            <span className="font-mono">{String(sub)}</span>
          ) : (
            formatar(sub, coluna.subFormato)
          )}
        </p>
      ) : null}
    </div>
  );
}

export type Permissoes = { criar: boolean; editar: boolean; excluir: boolean };

/**
 * Tela de cadastro genérica: lista com busca, modal de criação/edição e
 * exclusão com confirmação. Toda persistência passa pela API informada em
 * `endpoint`, que aplica as validações e o controle de permissão no servidor.
 */
export function Crud<T extends { id: string }>({
  endpoint,
  registros,
  colunas,
  campos,
  permissoes,
  rotuloSingular,
  buscaPlaceholder = "Buscar...",
  filtros,
}: {
  endpoint: string;
  registros: T[];
  colunas: ColunaConfig[];
  campos: CampoConfig[];
  permissoes: Permissoes;
  rotuloSingular: string;
  buscaPlaceholder?: string;
  filtros?: React.ReactNode;
}) {
  const router = useRouter();
  const [busca, setBusca] = React.useState("");
  const [editando, setEditando] = React.useState<T | null>(null);
  const [criando, setCriando] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState<T | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [errosCampos, setErrosCampos] = React.useState<Record<string, string[]>>({});
  const [salvando, setSalvando] = React.useState(false);

  const aberto = criando || editando !== null;

  const filtrados = React.useMemo(() => {
    if (!busca.trim()) return registros;
    const termo = busca.toLowerCase();
    return registros.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(termo),
    );
  }, [registros, busca]);

  function fechar() {
    setCriando(false);
    setEditando(null);
    setErro(null);
    setErrosCampos({});
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setErrosCampos({});
    setSalvando(true);

    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};

    for (const campo of campos) {
      if (editando && campo.somenteCriacao) continue;
      const bruto = form.get(campo.nome);
      if (campo.tipo === "checkbox") {
        payload[campo.nome] = bruto === "on";
      } else if (bruto === "" || bruto === null) {
        // Campo vazio vira null para não sobrescrever com string vazia.
        payload[campo.nome] = campo.obrigatorio ? "" : null;
      } else {
        payload[campo.nome] = bruto;
      }
    }

    try {
      const resp = await fetch(editando ? `${endpoint}/${editando.id}` : endpoint, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível salvar.");
        setErrosCampos(json.campos ?? {});
        return;
      }
      fechar();
      router.refresh();
    } catch {
      setErro("Falha de conexão com o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!excluindo) return;
    setSalvando(true);
    try {
      const resp = await fetch(`${endpoint}/${excluindo.id}`, { method: "DELETE" });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(json.erro ?? "Não foi possível excluir.");
        return;
      }
      setExcluindo(null);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-tinta-100 p-4">
          <div className="relative min-w-56 flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-400"
              width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13 13l4 4" strokeLinecap="round" />
            </svg>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={buscaPlaceholder}
              className="pl-9"
            />
          </div>
          {filtros}
          {permissoes.criar ? (
            <Botao onClick={() => setCriando(true)}>+ Novo {rotuloSingular.toLowerCase()}</Botao>
          ) : null}
        </div>

        {erro && !aberto ? (
          <div className="p-4">
            <Alerta tom="erro">{erro}</Alerta>
          </div>
        ) : null}

        <Tabela>
          <thead>
            <tr>
              {colunas.map((c) => (
                <Th key={c.chave} className={c.alinhamento === "direita" ? "text-right" : undefined}>
                  {c.label}
                </Th>
              ))}
              {permissoes.editar || permissoes.excluir ? <Th className="text-right">Ações</Th> : null}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((registro) => (
              <tr key={registro.id} className="hover:bg-tinta-50/60">
                {colunas.map((c) => (
                  <Td key={c.chave} className={c.alinhamento === "direita" ? "text-right tabular-nums" : undefined}>
                    <Celula registro={registro as unknown as Record<string, unknown>} coluna={c} />
                  </Td>
                ))}
                {permissoes.editar || permissoes.excluir ? (
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {permissoes.editar ? (
                        <button
                          onClick={() => setEditando(registro)}
                          className="rounded px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50"
                        >
                          Editar
                        </button>
                      ) : null}
                      {permissoes.excluir ? (
                        <button
                          onClick={() => setExcluindo(registro)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
            {filtrados.length === 0 ? (
              <Vazio
                colSpan={colunas.length + 1}
                mensagem={busca ? "Nenhum resultado para a busca." : "Nenhum registro cadastrado."}
              />
            ) : null}
          </tbody>
        </Tabela>

        <div className="border-t border-tinta-100 px-4 py-2.5 text-xs text-tinta-500">
          {filtrados.length} de {registros.length} registro(s)
        </div>
      </Card>

      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={editando ? `Editar ${rotuloSingular.toLowerCase()}` : `Novo ${rotuloSingular.toLowerCase()}`}
        largura="lg"
      >
        <form onSubmit={salvar} id="form-crud" className="space-y-4">
          {erro ? <Alerta tom="erro">{erro}</Alerta> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {campos
              .filter((c) => !(editando && c.somenteCriacao))
              .map((campo) => (
                <CampoFormulario
                  key={campo.nome}
                  campo={campo}
                  valor={editando ? (editando as Record<string, unknown>)[campo.nome] : campo.padrao}
                  erro={errosCampos[campo.nome]}
                />
              ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-tinta-100 pt-4">
            <Botao type="button" variante="secundario" onClick={fechar} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Botao>
          </div>
        </form>
      </Modal>

      <Confirmacao
        aberto={excluindo !== null}
        aoFechar={() => setExcluindo(null)}
        aoConfirmar={excluir}
        titulo={`Excluir ${rotuloSingular.toLowerCase()}`}
        mensagem="Esta ação não pode ser desfeita. Registros vinculados a outros dados do sistema não podem ser excluídos."
        rotuloConfirmar="Excluir"
        perigo
        carregando={salvando}
      />
    </>
  );
}

function CampoFormulario({
  campo,
  valor,
  erro,
}: {
  campo: CampoConfig;
  valor: unknown;
  erro?: string[];
}) {
  const tipo = campo.tipo ?? "texto";

  if (tipo === "checkbox") {
    return (
      <label className="flex items-center gap-2.5 self-end pb-2 sm:col-span-2">
        <input
          type="checkbox"
          name={campo.nome}
          defaultChecked={Boolean(valor)}
          className="h-4 w-4 rounded border-tinta-300 text-marca-600 focus:ring-marca-500"
        />
        <span className="text-sm text-tinta-700">{campo.label}</span>
      </label>
    );
  }

  const conteudo = () => {
    if (tipo === "select") {
      return (
        <Select name={campo.nome} defaultValue={String(valor ?? "")} required={campo.obrigatorio}>
          <option value="">Selecione...</option>
          {campo.opcoes?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      );
    }
    if (tipo === "textarea") {
      return <Textarea name={campo.nome} defaultValue={String(valor ?? "")} placeholder={campo.placeholder} />;
    }
    if (tipo === "data") {
      const iso = valor ? new Date(String(valor)).toISOString().slice(0, 10) : "";
      return <Input type="date" name={campo.nome} defaultValue={iso} required={campo.obrigatorio} />;
    }
    return (
      <Input
        type={tipo === "numero" || tipo === "moeda" ? "number" : "text"}
        step={tipo === "moeda" ? "0.01" : tipo === "numero" ? "1" : undefined}
        min={tipo === "moeda" || tipo === "numero" ? "0" : undefined}
        name={campo.nome}
        defaultValue={String(valor ?? "")}
        placeholder={campo.placeholder}
        required={campo.obrigatorio}
      />
    );
  };

  return (
    <Campo
      label={campo.label}
      obrigatorio={campo.obrigatorio}
      dica={campo.dica}
      erro={erro}
      className={campo.largo || tipo === "textarea" ? "sm:col-span-2" : undefined}
    >
      {conteudo()}
    </Campo>
  );
}

