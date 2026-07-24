import { exigirPagina } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { pode, MODULOS_POR_AREA } from "@/lib/permissions";
import { AREAS, AREA_LABEL, PERFIS, PERFIL_LABEL, type Area } from "@/lib/constants";
import { dataHora, numero } from "@/lib/utils";
import { Badge, Card, CardHeader, Indicador, Tabela, Td, Th, TituloPagina } from "@/components/ui";
import { Crud, type CampoConfig, type ColunaConfig } from "@/components/crud";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  area: string;
  perfil: string;
  ativo: boolean;
  ultimoLogin: string | null;
};

export default async function UsuariosPage() {
  const sessao = await exigirPagina("usuarios");

  const usuarios = await prisma.usuario.findMany({ orderBy: { nome: "asc" } });
  // Nunca envie o hash de senha para o cliente. Rótulos são resolvidos aqui
  // porque as colunas do Crud são declarativas.
  const lista = usuarios.map(({ senhaHash: _ignorado, ...u }) => ({
    ...u,
    areaExibicao: AREA_LABEL[u.area as Area] ?? u.area,
    perfilExibicao: PERFIL_LABEL[u.perfil as keyof typeof PERFIL_LABEL] ?? u.perfil,
    ultimoAcesso: u.ultimoLogin ? dataHora(u.ultimoLogin) : "Nunca",
  })) as unknown as Linha[];

  const colunas: ColunaConfig[] = [
    { chave: "nome", label: "Usuário", sub: "email" },
    { chave: "cargo", label: "Cargo" },
    { chave: "areaExibicao", label: "Área" },
    { chave: "perfilExibicao", label: "Perfil", formato: "badge" },
    { chave: "ultimoAcesso", label: "Último acesso" },
    {
      chave: "ativo",
      label: "Situação",
      booleano: { verdadeiro: "Ativo", falso: "Inativo", statusVerdadeiro: "ATIVO", statusFalso: "INATIVO" },
    },
  ];

  const campos: CampoConfig[] = [
    { nome: "nome", label: "Nome completo", obrigatorio: true },
    { nome: "email", label: "E-mail corporativo", obrigatorio: true },
    { nome: "cargo", label: "Cargo" },
    {
      nome: "senha",
      label: "Senha",
      dica: "Ao editar, deixe em branco para manter a senha atual. Mínimo de 6 caracteres.",
    },
    {
      nome: "area",
      label: "Área",
      tipo: "select",
      obrigatorio: true,
      opcoes: Object.keys(AREAS).map((a) => ({ valor: a, rotulo: AREA_LABEL[a as Area] })),
    },
    {
      nome: "perfil",
      label: "Perfil de acesso",
      tipo: "select",
      obrigatorio: true,
      opcoes: Object.keys(PERFIS).map((p) => ({ valor: p, rotulo: PERFIL_LABEL[p as keyof typeof PERFIL_LABEL] })),
    },
    { nome: "ativo", label: "Usuário ativo", tipo: "checkbox", padrao: true },
  ];

  return (
    <>
      <TituloPagina
        modulo="usuarios"
        titulo="Usuários e acessos"
        descricao="Controle de quem acessa o quê. A área define os módulos; o perfil define as ações."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Usuários" valor={numero(usuarios.length)} />
        <Indicador titulo="Ativos" valor={numero(usuarios.filter((u) => u.ativo).length)} tom="positivo" />
        <Indicador titulo="Áreas" valor={numero(Object.keys(AREAS).length)} />
        <Indicador titulo="Perfis" valor={numero(Object.keys(PERFIS).length)} />
      </section>

      <div className="mt-6 space-y-6">
        <Crud
          endpoint="/api/usuarios"
          registros={lista}
          colunas={colunas}
          campos={campos}
          rotuloSingular="Usuário"
          buscaPlaceholder="Buscar por nome, e-mail, área..."
          permissoes={{
            criar: pode(sessao, "usuarios", "CRIAR"),
            editar: pode(sessao, "usuarios", "EDITAR"),
            excluir: pode(sessao, "usuarios", "EXCLUIR"),
          }}
        />

        <Card>
          <CardHeader
            titulo="Matriz de acesso por área"
            descricao="Módulos visíveis para cada área da estrutura organizacional"
          />
          <Tabela>
            <thead>
              <tr>
                <Th>Área</Th>
                <Th>Módulos acessíveis</Th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(AREAS) as Area[]).map((area) => (
                <tr key={area}>
                  <Td className="font-medium text-tinta-900">{AREA_LABEL[area]}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {MODULOS_POR_AREA[area].map((m) => (
                        <Badge key={m}>{m}</Badge>
                      ))}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Card>
      </div>
    </>
  );
}
