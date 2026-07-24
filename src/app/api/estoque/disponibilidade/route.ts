import { exigir, ok, tratarErro } from "@/lib/api";
import { consultarDisponibilidade } from "@/server/pedidos";

/** Consulta usada pelo Comercial ao montar o pedido: GET ?produtoId=..&quantidade=.. */
export async function GET(req: Request) {
  try {
    await exigir("produtos", "VER");
    const url = new URL(req.url);
    const produtoId = url.searchParams.get("produtoId");
    const quantidade = Number(url.searchParams.get("quantidade") ?? 1);

    if (!produtoId) return ok({ erro: "Informe o produto." }, 400);

    try {
      return ok(await consultarDisponibilidade(produtoId, quantidade));
    } catch {
      // Estoque insuficiente não é erro de sistema, é resposta de negócio.
      return ok({ disponivel: 0, atende: false, lotes: [] });
    }
  } catch (erro) {
    return tratarErro(erro);
  }
}
