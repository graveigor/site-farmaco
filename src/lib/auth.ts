import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Sessao } from "./permissions";
import type { Area, Perfil } from "./constants";

const COOKIE = "sf_sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 8; // 8 horas

function chave(): Uint8Array {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo || segredo.length < 16) {
    throw new Error("AUTH_SECRET ausente ou muito curto. Configure no .env.");
  }
  return new TextEncoder().encode(segredo);
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export async function criarSessao(sessao: Sessao): Promise<void> {
  const token = await new SignJWT({ ...sessao })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(chave());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Le a sessao do cookie. Retorna null se ausente ou invalida. */
export async function obterSessao(): Promise<Sessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    return {
      id: String(payload.id),
      nome: String(payload.nome),
      email: String(payload.email),
      area: payload.area as Area,
      perfil: payload.perfil as Perfil,
    };
  } catch {
    return null;
  }
}

/** Autentica por email/senha. Retorna null quando as credenciais nao batem. */
export async function autenticar(email: string, senha: string): Promise<Sessao | null> {
  const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!usuario || !usuario.ativo) return null;
  if (!(await conferirSenha(senha, usuario.senhaHash))) return null;

  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLogin: new Date() } });

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    area: usuario.area as Area,
    perfil: usuario.perfil as Perfil,
  };
}
