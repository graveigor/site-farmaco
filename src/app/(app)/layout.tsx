import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";
import { modulosVisiveis } from "@/lib/permissions";
import { Sidebar } from "@/components/sidebar";
import { SincronizacaoProvider } from "@/components/sincronizacao";
import { TourBoasVindas } from "@/components/guia";
import { prisma } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  const modulos = modulosVisiveis(sessao);

  // O tour abre sozinho enquanto a pessoa não tiver concluído.
  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.id },
    select: { tourVistoEm: true },
  });

  return (
    // O provider mantém a conexão de tempo real: recarrega a tela quando outro
    // usuário altera algo que ela exibe e avisa quem está online.
    <SincronizacaoProvider usuarioId={sessao.id}>
      <div className="min-h-screen">
        <Sidebar sessao={sessao} modulos={modulos} />
        <div className="lg:pl-64">
          <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>

      <TourBoasVindas
        nome={sessao.nome}
        area={sessao.area}
        perfil={sessao.perfil}
        modulos={modulos}
        jaViu={Boolean(usuario?.tourVistoEm)}
      />
    </SincronizacaoProvider>
  );
}
