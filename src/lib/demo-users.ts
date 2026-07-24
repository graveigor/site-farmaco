/**
 * Usuários de demonstração — fonte única compartilhada entre o seed do banco
 * (prisma/seed.ts) e o atalho de acesso rápido da tela de login.
 *
 * Alterar esta lista muda os dois lugares. Rode `npm run db:reset` depois.
 */

export const SENHA_DEMO = "farma@2026";

export type UsuarioDemo = {
  nome: string;
  email: string;
  area: string;
  perfil: string;
  cargo: string;
};

export const USUARIOS_DEMO: UsuarioDemo[] = [
  { nome: "Ana Ribeiro", email: "admin@distribuidora.com.br", area: "DIRETORIA", perfil: "ADMINISTRADOR", cargo: "Administradora do sistema" },
  { nome: "Carlos Menezes", email: "presidencia@distribuidora.com.br", area: "DIRETORIA", perfil: "PRESIDENCIA", cargo: "Presidente" },
  { nome: "Beatriz Cunha", email: "financeiro@distribuidora.com.br", area: "FINANCEIRO", perfil: "GERENTE", cargo: "Gerente financeira" },
  { nome: "Diego Farias", email: "suprimentos@distribuidora.com.br", area: "SUPRIMENTOS", perfil: "ANALISTA", cargo: "Analista de compras" },
  { nome: "Elisa Tavares", email: "marketing@distribuidora.com.br", area: "MARKETING", perfil: "ANALISTA", cargo: "Analista de marketing" },
  { nome: "Fernando Lopes", email: "comercial@distribuidora.com.br", area: "COMERCIAL", perfil: "GERENTE", cargo: "Gerente comercial" },
  { nome: "Gabriela Souza", email: "vendas@distribuidora.com.br", area: "COMERCIAL", perfil: "ANALISTA", cargo: "Executiva de vendas" },
  { nome: "Henrique Alves", email: "logistica@distribuidora.com.br", area: "LOGISTICA", perfil: "GERENTE", cargo: "Gerente de logística" },
  { nome: "Igor Pacheco", email: "expedicao@distribuidora.com.br", area: "LOGISTICA", perfil: "OPERADOR", cargo: "Separador" },
  { nome: "Juliana Reis", email: "rh@distribuidora.com.br", area: "ADMINISTRATIVO", perfil: "GERENTE", cargo: "Gerente de DHO" },
];
