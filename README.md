# Sistema Farma — Gestão de Distribuidora Farmacêutica

Plataforma integrada para operação de distribuidora farmacêutica, cobrindo Comercial,
Suprimentos, Logística, Financeiro, Marketing e Administrativo/RH/DHO.

## Como rodar

```bash
npm install
npm run db:reset   # cria o banco e popula com dados de demonstração
npm run dev
```

Acesse http://localhost:3000.

### Usuários de demonstração

A tela de login mostra um painel de **acesso rápido**: basta clicar no usuário para entrar
direto, sem digitar nada. O painel aparece somente fora de produção — a condição está em
`MOSTRAR_ATALHOS`, em `src/app/login/page.tsx`.

A lista de usuários vive em `src/lib/demo-users.ts` e alimenta tanto o painel quanto o
seed do banco, para que os dois nunca divirjam.

Senha para todos: `farma@2026`

| E-mail | Perfil | Área |
| --- | --- | --- |
| admin@distribuidora.com.br | Administrador | Diretoria |
| presidencia@distribuidora.com.br | Presidência | Diretoria |
| financeiro@distribuidora.com.br | Gerente | Financeiro |
| suprimentos@distribuidora.com.br | Analista | Suprimentos |
| marketing@distribuidora.com.br | Analista | Marketing |
| comercial@distribuidora.com.br | Gerente | Comercial |
| vendas@distribuidora.com.br | Analista | Comercial |
| logistica@distribuidora.com.br | Gerente | Logística |
| expedicao@distribuidora.com.br | Operador | Logística |
| rh@distribuidora.com.br | Gerente | Administrativo |

Entre com perfis diferentes para ver o menu e as ações mudarem conforme a permissão.

## Testes

```bash
npm test
```

98 testes cobrindo as regras de negócio — o código que, se quebrar, causa prejuízo real
(estoque errado, título duplicado, venda acima do crédito).

Os testes de **lógica pura** (permissões, validação, sincronização — 54 testes) rodam sempre.
Os testes de **banco** (44 testes) precisam de um Postgres: defina `TEST_DATABASE_URL`
apontando para um banco dedicado a testes. Sem essa variável, eles se pulam sozinhos e
`npm test` continua verde com os testes de lógica.

```bash
TEST_DATABASE_URL="postgresql://.../banco_de_testes" npm test
```

| Arquivo | O que cobre |
| --- | --- |
| `tests/pedidos.test.mts` | Ciclo completo do pedido e cada bloqueio: transição fora de ordem, estoque insuficiente, cliente bloqueado, limite de crédito, divergência na conferência, liberação de reserva no cancelamento |
| `tests/estoque.test.mts` | FEFO (inclusive divisão entre lotes), exclusão de vencidos e bloqueados, desconto de reservas, custo médio ponderado, alertas |
| `tests/compras.test.mts` | Contas a pagar na aprovação, recebimento com lote, recebimento parcial, recusa de lote vencido, sugestão de reposição |
| `tests/financeiro.test.mts` | Baixa total e parcial, recusa acima do saldo, arredondamento de centavos, fluxo de caixa, inadimplência |
| `tests/devolucoes.test.mts` | Retorno ao estoque só no destino Revenda, kardex, saldo negativo |
| `tests/sincronizacao.test.mts` | Mapa de impacto por rota, cobertura de todas as entidades publicadas, texto das notificações |
| `tests/permissoes.test.mts` | Matriz área × perfil e módulos restritos |
| `tests/validacao.test.mts` | Schemas Zod, CNPJ, numeração de documentos, integridade da máquina de estados |

Cada arquivo de teste de banco usa um **schema Postgres próprio** (isolamento), criado a
partir de `TEST_DATABASE_URL`. A infraestrutura está em `tests/apoio.mts`.

Os testes usam extensão `.mts` porque precisam de ESM (top-level await) para apontar o
`DATABASE_URL` ao banco de teste antes de importar o cliente Prisma.

## Stack

- **Next.js 15** (App Router, Server Components) + **TypeScript**
- **Tailwind CSS v4** — tema corporativo em `src/app/globals.css`
- **Prisma** sobre **PostgreSQL** (Neon na Vercel — ver "Deploy na Vercel")
- **Zod** para validação de entrada
- Sessão própria via **JWT em cookie httpOnly** (`jose`) + `bcryptjs`

## Organização do código

```
prisma/
  schema.prisma          modelo de dados completo
  seed.ts                dados de demonstração
src/
  app/
    (app)/               páginas autenticadas (uma pasta por módulo)
    api/                 rotas REST
    login/               autenticação
  components/            UI reutilizável (ui.tsx, crud.tsx, modal.tsx, gráficos)
  lib/
    api.ts               guarda de permissão, tratamento de erro, auditoria
    permissions.ts       matriz de acesso área × perfil
    schemas.ts           validação Zod de todas as entradas
    crud-api.ts          fábrica de rotas CRUD padrão
    constants.ts         status, transições e rótulos do domínio
  server/                regras de negócio
    estoque.ts           FEFO, reserva, movimentação, custo médio
    pedidos.ts           fluxo do pedido de venda
    compras.ts           fluxo de compra e recebimento
    dashboard.ts         consolidação de indicadores
  middleware.ts          bloqueio de rotas sem sessão
```

## Sincronização em tempo real

Os dados sempre foram compartilhados — o banco é único. O que esta camada resolve é a
**propagação sem recarregar a página**: quando alguém cadastra um cliente, a lista de quem
está com a tela aberta se atualiza sozinha, com um aviso de quem fez o quê.

**Como funciona.** Toda mutação já passava por `registrarLog` (a trilha de auditoria).
Esse é o ponto único onde o evento é publicado — por isso a cobertura é total sem precisar
instrumentar cada rota. Um endpoint SSE (`/api/eventos`) mantém uma conexão por aba aberta,
e o cliente decide se recarrega.

```
mutação → registrarLog → barramento → SSE → aba do colega → router.refresh()
```

**Só recarrega o que importa.** `src/lib/eventos-mapa.ts` define quais telas cada entidade
afeta. Um cadastro de cliente atualiza `/clientes`, `/pedidos` e `/financeiro`, mas não
mexe em `/rh`. Sem esse filtro, toda tela piscaria a cada alteração de qualquer módulo.

**Presença.** O rodapé da sidebar mostra quem está conectado, por área. Um usuário com
várias abas conta como uma pessoa só.

SSE (e não WebSocket) porque o fluxo é apenas do servidor para o cliente e o navegador já
reconecta sozinho — sem biblioteca extra nem servidor adicional.

> **Limite de escala:** o barramento vive na memória do processo, o que atende uma
> instância única (VPS ou container). Com várias instâncias atrás de um balanceador, cada
> uma só avisaria seus próprios conectados. A troca é localizada: reimplementar `publicar`
> e `assinar` em `src/server/eventos.ts` sobre Redis pub/sub ou Postgres LISTEN/NOTIFY,
> sem tocar no resto do código.

## Controle de acesso

Duas dimensões combinadas (`src/lib/permissions.ts`):

- **Área** define quais **módulos** o usuário enxerga (Comercial não vê Financeiro).
- **Perfil** define quais **ações** pode executar (Operador vê e edita, mas não aprova nem exclui).

A checagem acontece em três camadas: `middleware.ts` (sessão), `exigirPagina()` nas
páginas e `exigir()` nas rotas de API. **A camada de API é a que efetivamente protege** —
esconder um botão não é controle de acesso.

Ações relevantes (criação, edição, exclusão, aprovação, login) são gravadas em `LogAcao`
e visíveis em Auditoria.

## Fluxos integrados

### Pedido de venda (Comercial → Logística → Financeiro)

```
RASCUNHO → AGUARDANDO_APROVACAO → APROVADO → EM_SEPARACAO
        → CONFERIDO → FATURADO → EXPEDIDO → EM_TRANSPORTE → ENTREGUE
```

Efeitos automáticos em cada etapa:

- **Aguardando aprovação** — valida cliente bloqueado, limite de crédito (considerando
  títulos em aberto) e disponibilidade de estoque.
- **Aprovado** — reserva lotes por **FEFO** e abre a ordem de separação.
- **Conferido** — bloqueia o avanço se houver divergência entre separado e pedido.
- **Faturado** — emite nota fiscal, gera o título no contas a receber e apura comissão.
- **Expedido** — baixa o estoque consumindo a reserva e registra o movimento no kardex.
- **Entregue** — encerra a entrega.

Transições fora do fluxo são rejeitadas (`TRANSICOES_PEDIDO_VENDA`).

### Compra (Suprimentos → Logística → Financeiro)

```
RASCUNHO → AGUARDANDO_APROVACAO → APROVADO → RECEBIDO_PARCIAL → RECEBIDO
```

- **Aprovado** — cria o título no contas a pagar.
- **Recebimento** — exige lote e validade (rastreamento sanitário), recusa lote vencido,
  cria/atualiza o lote, movimenta o estoque e **recalcula o custo médio ponderado**,
  registrando a alteração em `HistoricoPreco`.

### Devoluções

Aprovada com destino **Revenda** retorna o item ao estoque no lote de origem. Os demais
destinos (descarte, quarentena, retorno ao fornecedor) não recompõem o saldo disponível.

## Controle de lotes e validade

Central em distribuição farmacêutica. Cada lote tem código, validade, quantidade,
quantidade reservada e endereço físico. A separação sugere lotes por **FEFO**
(vence primeiro, sai primeiro). O dashboard e o módulo de Estoque alertam sobre lotes
vencidos, próximos do vencimento (90 e 30 dias), estoque baixo e zerado.

## Banco de dados

O projeto usa **PostgreSQL** (o schema evita enums e arrays de propósito; os status são
`String` validados na aplicação por `src/lib/constants.ts`). Use a mesma connection string
em desenvolvimento e produção, ou um Postgres local em dev.

Para desenvolver localmente:

1. Cole a `DATABASE_URL` (do Neon ou de um Postgres local) no `.env`.
2. `npm run db:push` cria as tabelas; `npm run db:seed` popula os dados de demonstração.
3. `npm run dev`.

## Deploy na Vercel

O repositório já está pronto para a Vercel. Passos, uma vez só:

1. **Banco:** no painel do projeto na Vercel, vá em **Storage → Create Database → Postgres
   (Neon)**. A Vercel cria e injeta a variável `DATABASE_URL` sozinha.
2. **Sessão:** em **Settings → Environment Variables**, adicione `AUTH_SECRET` com um valor
   gerado por `openssl rand -base64 32`.
3. **Redeploy.** O build usa o script `vercel-build`:
   `prisma generate && prisma db push && tsx prisma/seed.ts && next build`.
   Ele cria as tabelas e popula os usuários de demonstração no primeiro deploy.

O seed é **idempotente**: se já houver usuários, ele é ignorado e não apaga nada (guardado
por `SEED_FORCE`). Assim, deploys seguintes não zeram os dados.

Depois do primeiro deploy, entre com qualquer usuário da tabela acima (senha `farma@2026`).

> **Binary target do Prisma:** o schema declara `rhel-openssl-3.0.x` além de `native`, que é
> o runtime das funções serverless da Vercel. Sem ele, o Prisma não acha o engine em produção.

> **Tempo real em serverless:** o barramento de eventos vive na memória do processo. Em uma
> instância única funciona; com o autoscaling da Vercel, dois usuários podem cair em funções
> diferentes e não ver os eventos um do outro. O app continua correto — os dados sincronizam
> ao navegar/atualizar. Para tempo real confiável em produção, troque o barramento por Redis
> pub/sub ou Postgres LISTEN/NOTIFY (ver `src/server/eventos.ts`).

## Pontos de atenção antes de produção

Itens conscientemente fora do escopo desta entrega:

- **Valores monetários usam `Float`.** Adequado para demonstração; em produção use
  `Decimal` (Postgres `numeric`) ou inteiros em centavos para evitar erro de arredondamento.
- **Emissão fiscal é simulada.** `NotaFiscal` gera número e chave internos; não há
  integração com SEFAZ nem geração de XML/DANFE.
- **`AUTH_SECRET` precisa ser trocado.** Gere com `openssl rand -base64 32`.
- **`prisma db push` no build** cria/atualiza o schema direto, sem migrations versionadas.
  Bom para demonstração; para produção real, adote `prisma migrate` com histórico de migração.
- **`sharp` tem 3 vulnerabilidades `high`** (herdadas do libvips, via otimizador de imagens do
  Next). Baixo risco aqui, já que a UI usa SVG inline e não `next/image`. Some ao subir a
  versão do Next que empacote um `sharp` corrigido.
- **Testes cobrem a camada de negócio, não a interface.** Não há testes de componente nem
  end-to-end de navegador; a UI foi validada manualmente.
- **Listagens carregam até 100–300 registros** sem paginação na UI. O helper `paginacao()`
  existe em `src/lib/api.ts` mas ainda não está ligado às telas.
