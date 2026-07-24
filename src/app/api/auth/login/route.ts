import { autenticar, criarSessao } from "@/lib/auth";
import { corpo, ok, registrarLog, tratarErro, ErroApi } from "@/lib/api";
import { loginSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const { email, senha } = await corpo(req, loginSchema);
    const sessao = await autenticar(email, senha);

    // Mensagem genérica: não revela se o e-mail existe.
    if (!sessao) throw new ErroApi(401, "E-mail ou senha inválidos.");

    await criarSessao(sessao);
    await registrarLog({ usuarioId: sessao.id, acao: "LOGIN", entidade: "Usuario", entidadeId: sessao.id });

    return ok({ sessao });
  } catch (erro) {
    return tratarErro(erro);
  }
}
