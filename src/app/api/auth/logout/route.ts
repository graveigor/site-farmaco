import { NextResponse } from "next/server";
import { encerrarSessao, obterSessao } from "@/lib/auth";
import { registrarLog } from "@/lib/api";

export async function POST(req: Request) {
  const sessao = await obterSessao();
  if (sessao) {
    await registrarLog({ usuarioId: sessao.id, acao: "LOGOUT", entidade: "Usuario", entidadeId: sessao.id });
  }
  await encerrarSessao();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
