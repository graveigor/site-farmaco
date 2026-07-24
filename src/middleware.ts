import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Guarda de borda: bloqueia o acesso às rotas internas sem sessão válida.
 * A checagem fina de permissão por módulo acontece em cada página/rota de API
 * (ver `exigir` em src/lib/api.ts) — aqui apenas validamos a autenticação.
 */

const PUBLICAS = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get("sf_sessao")?.value;
  let valido = false;

  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valido = true;
    } catch {
      valido = false;
    }
  }

  if (valido) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Sessão expirada ou inexistente." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirecionar", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Ignora assets estáticos e arquivos do Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
