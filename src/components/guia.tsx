"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import { Botao } from "./ui";
import { GUIAS, O_QUE_O_PERFIL_FAZ, ROTAS_MODULO, TITULOS_MODULO } from "@/lib/guias";
import { AREA_LABEL, PERFIL_LABEL, type Area, type Modulo, type Perfil } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Conteúdo do guia de um módulo — reaproveitado no tour e na ajuda da tela. */
function ConteudoGuia({ modulo }: { modulo: Modulo }) {
  const guia = GUIAS[modulo];
  if (!guia) return null;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-tinta-600">{guia.paraQueServe}</p>

      <div>
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-tinta-500">
          Como usar no dia a dia
        </h3>
        <ol className="space-y-3">
          {guia.passos.map((passo, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-100 text-xs font-semibold text-marca-700">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-tinta-900">{passo.titulo}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-tinta-600">{passo.descricao}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {guia.integracoes?.length ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3.5">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800">
            Conexão com outras áreas
          </h3>
          <ul className="space-y-1">
            {guia.integracoes.map((t, i) => (
              <li key={i} className="text-sm leading-relaxed text-blue-900">
                • {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {guia.atencao ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Atenção</h3>
          <p className="text-sm leading-relaxed text-amber-900">{guia.atencao}</p>
        </div>
      ) : null}
    </div>
  );
}

/** Botão de ajuda que fica no cabeçalho de cada tela. */
export function BotaoAjuda({ modulo }: { modulo: Modulo }) {
  const [aberto, setAberto] = React.useState(false);
  if (!GUIAS[modulo]) return null;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-600 transition hover:bg-tinta-50 hover:text-tinta-900"
        aria-label={`Como funciona: ${TITULOS_MODULO[modulo]}`}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M7.8 7.7a2.2 2.2 0 114.2 1c0 1.5-2 1.8-2 3" strokeLinecap="round" />
          <path d="M10 14.6h.01" strokeLinecap="round" strokeWidth="2" />
        </svg>
        Como funciona
      </button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={TITULOS_MODULO[modulo]}
        descricao={GUIAS[modulo].resumo}
        largura="md"
        rodape={<Botao onClick={() => setAberto(false)}>Entendi</Botao>}
      >
        <ConteudoGuia modulo={modulo} />
      </Modal>
    </>
  );
}

/**
 * Tour de boas-vindas, aberto sozinho no primeiro acesso de cada pessoa.
 *
 * O conteúdo é montado a partir dos módulos que ESTA pessoa enxerga — quem é da
 * Logística não recebe explicação de Financeiro, que nem consegue abrir.
 */
export function TourBoasVindas({
  nome,
  area,
  perfil,
  modulos,
  jaViu,
}: {
  nome: string;
  area: Area;
  perfil: Perfil;
  modulos: Modulo[];
  jaViu: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = React.useState(!jaViu);
  const [etapa, setEtapa] = React.useState(0);
  const [salvando, setSalvando] = React.useState(false);

  // Módulos operacionais (fora o dashboard) que esta pessoa acessa.
  const meusModulos = modulos.filter((m) => m !== "dashboard" && GUIAS[m]);
  const veOFluxo = modulos.includes("pedidos") || modulos.includes("logistica") || modulos.includes("compras");

  const etapas = [
    { chave: "boas-vindas", titulo: `Bem-vindo, ${nome.split(" ")[0]}` },
    { chave: "modulos", titulo: "O que você acessa" },
    ...(veOFluxo ? [{ chave: "fluxo", titulo: "Como o trabalho circula" }] : []),
    { chave: "ajuda", titulo: "Ajuda sempre à mão" },
  ];

  const ultima = etapa === etapas.length - 1;

  async function concluir() {
    setSalvando(true);
    try {
      await fetch("/api/onboarding", { method: "POST" });
      setAberto(false);
      router.refresh();
    } catch {
      // Se falhar em gravar, ao menos fecha — o tour reabre no próximo acesso.
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={concluir}
      titulo={etapas[etapa].titulo}
      descricao={`Passo ${etapa + 1} de ${etapas.length}`}
      largura="lg"
      rodape={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            onClick={concluir}
            disabled={salvando}
            className="text-sm text-tinta-500 underline-offset-2 hover:text-tinta-800 hover:underline"
          >
            Pular apresentação
          </button>
          <div className="flex items-center gap-2">
            {etapa > 0 ? (
              <Botao variante="secundario" onClick={() => setEtapa((e) => e - 1)} disabled={salvando}>
                Voltar
              </Botao>
            ) : null}
            <Botao onClick={() => (ultima ? concluir() : setEtapa((e) => e + 1))} disabled={salvando}>
              {salvando ? "Salvando..." : ultima ? "Começar a usar" : "Avançar"}
            </Botao>
          </div>
        </div>
      }
    >
      {/* Indicador de progresso */}
      <div className="mb-5 flex gap-1.5">
        {etapas.map((e, i) => (
          <span
            key={e.chave}
            className={cn("h-1 flex-1 rounded-full transition", i <= etapa ? "bg-marca-500" : "bg-tinta-200")}
          />
        ))}
      </div>

      {etapas[etapa].chave === "boas-vindas" ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-tinta-600">
            Este é o sistema de gestão da distribuidora. Ele reúne comercial, suprimentos, logística, financeiro,
            marketing e RH em um lugar só — o que uma área registra, as outras enxergam na hora.
          </p>

          <div className="rounded-lg border border-tinta-200 bg-tinta-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-tinta-500">Seu acesso</p>
            <p className="mt-1.5 text-sm text-tinta-900">
              <span className="font-medium">{AREA_LABEL[area]}</span> · {PERFIL_LABEL[perfil]}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-tinta-600">
              {O_QUE_O_PERFIL_FAZ[perfil] ?? "Seu acesso é definido pela sua área e perfil."}
            </p>
          </div>

          <p className="text-sm leading-relaxed text-tinta-500">
            Por isso o menu à esquerda mostra só o que faz parte do seu trabalho. Se precisar de algo que não aparece,
            fale com o administrador.
          </p>
        </div>
      ) : null}

      {etapas[etapa].chave === "modulos" ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-tinta-600">
            Estas são as telas disponíveis para você. Cada uma tem um guia próprio, que você abre a qualquer momento.
          </p>
          <ul className="space-y-2">
            {meusModulos.map((m) => (
              <li key={m} className="rounded-lg border border-tinta-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-tinta-900">{TITULOS_MODULO[m]}</p>
                    <p className="mt-0.5 text-sm text-tinta-600">{GUIAS[m].resumo}</p>
                  </div>
                  <Link
                    href={ROTAS_MODULO[m]}
                    onClick={concluir}
                    className="shrink-0 text-xs font-medium text-marca-700 hover:underline"
                  >
                    Abrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {etapas[etapa].chave === "fluxo" ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-tinta-600">
            Nada aqui é uma tela isolada. Um pedido nasce no Comercial e atravessa a empresa inteira — cada etapa
            libera a próxima automaticamente.
          </p>

          <div className="rounded-lg border border-tinta-200 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-tinta-500">Venda</p>
            <ol className="space-y-2">
              {[
                ["Comercial", "cria o pedido e envia para aprovação"],
                ["Sistema", "confere crédito do cliente e estoque disponível"],
                ["Logística", "separa pelos lotes que vencem antes e confere"],
                ["Faturamento", "emite a nota e gera o título a receber"],
                ["Expedição", "dá baixa no estoque e despacha"],
                ["Financeiro", "recebe e baixa o título"],
              ].map(([quem, oque], i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-marca-500" />
                  <span className="text-tinta-700">
                    <span className="font-medium text-tinta-900">{quem}</span> {oque}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-tinta-200 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-tinta-500">Compra</p>
            <ol className="space-y-2">
              {[
                ["Suprimentos", "monta o pedido a partir da sugestão de reposição"],
                ["Gerência", "aprova — e o título a pagar nasce automaticamente"],
                ["Logística", "recebe informando lote e validade"],
                ["Sistema", "dá entrada no estoque e recalcula o custo do produto"],
              ].map(([quem, oque], i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span className="text-tinta-700">
                    <span className="font-medium text-tinta-900">{quem}</span> {oque}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      {etapas[etapa].chave === "ajuda" ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-tinta-600">
            Você não precisa decorar nada. Em toda tela existe o botão{" "}
            <span className="inline-flex items-center gap-1 rounded border border-tinta-300 bg-white px-1.5 py-0.5 text-xs font-medium text-tinta-700">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="10" cy="10" r="7.5" />
                <path d="M7.8 7.7a2.2 2.2 0 114.2 1c0 1.5-2 1.8-2 3" strokeLinecap="round" />
                <path d="M10 14.6h.01" strokeLinecap="round" strokeWidth="2" />
              </svg>
              Como funciona
            </span>{" "}
            no canto superior direito. Ele explica para que serve aquela tela, o passo a passo e as armadilhas comuns.
          </p>

          <div className="rounded-lg border border-marca-200 bg-marca-50 p-4">
            <p className="text-sm leading-relaxed text-marca-900">
              Outra coisa: o sistema é compartilhado e ao vivo. Quando um colega cadastra ou aprova algo, sua tela se
              atualiza sozinha e aparece um aviso no canto. No rodapé do menu você vê quem está conectado agora.
            </p>
          </div>

          <p className="text-sm text-tinta-500">
            Esta apresentação não aparece de novo. Para revê-la, use o botão de ajuda de qualquer tela.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
