import type { Modulo } from "./constants";

/**
 * Conteúdo de ajuda de cada módulo.
 *
 * É o material que alimenta tanto o tour de boas-vindas quanto o botão de ajuda
 * presente no cabeçalho de cada tela. Fica separado da UI de propósito: é texto
 * de negócio, revisado por quem entende a operação, não código.
 *
 * Arquivo client-safe — não importa nada do servidor.
 */

export type Guia = {
  /** Frase curta que aparece na lista de módulos do tour. */
  resumo: string;
  /** Para que a tela serve na operação real da distribuidora. */
  paraQueServe: string;
  /** Passo a passo do uso cotidiano. */
  passos: { titulo: string; descricao: string }[];
  /** Como esta tela conversa com as outras áreas. */
  integracoes?: string[];
  /** Ponto de atenção — regra que costuma pegar as pessoas de surpresa. */
  atencao?: string;
};

export const GUIAS: Record<Modulo, Guia> = {
  dashboard: {
    resumo: "Visão geral da operação em números.",
    paraQueServe:
      "É a primeira tela após o login. Reúne os indicadores da empresa — faturamento, pedidos em cada etapa, contas a pagar e receber, alertas de estoque e validade. Cada pessoa vê apenas os números da sua área.",
    passos: [
      {
        titulo: "Leia os cartões do topo",
        descricao:
          "Mostram os números do mês. A setinha ao lado do faturamento compara com o mês anterior: verde subiu, vermelha caiu.",
      },
      {
        titulo: "Confira os alertas coloridos",
        descricao:
          "Cartões com borda vermelha exigem ação hoje (lote vencido, estoque zerado, título em atraso). Borda amarela é aviso: dá para planejar.",
      },
      {
        titulo: "Clique nos cartões",
        descricao:
          "Quase todos levam direto à tela com a lista filtrada. Clicar em 'Lotes vencidos' abre o estoque já filtrado por eles.",
      },
      {
        titulo: "Acompanhe os gráficos",
        descricao:
          "O gráfico de barras traz o faturamento dos últimos 6 meses. A rosca mostra em que etapa os pedidos estão parados — útil para achar gargalo.",
      },
    ],
    integracoes: [
      "Os números vêm de todos os módulos e se atualizam sozinhos quando alguém registra algo.",
    ],
  },

  produtos: {
    resumo: "Cadastro dos itens que a distribuidora vende.",
    paraQueServe:
      "Onde ficam os dados fixos de cada produto: nome, princípio ativo, fabricante, códigos fiscais, preço e limites de estoque. O saldo em si vem dos lotes — aqui você define as regras.",
    passos: [
      {
        titulo: "Cadastre com o SKU correto",
        descricao:
          "O SKU é o código único do produto e não pode repetir. É por ele que o sistema amarra compras, vendas e estoque.",
      },
      {
        titulo: "Preencha os dados regulatórios",
        descricao:
          "NCM, CEST e registro ANVISA. Marque 'exige receita' e 'controlado' quando for o caso — produtos da Portaria 344 pedem controle redobrado.",
      },
      {
        titulo: "Defina estoque mínimo e máximo",
        descricao:
          "O mínimo dispara o alerta de reposição. O máximo é o alvo da sugestão de compra. Sem eles, o sistema não sabe quando avisar.",
      },
      {
        titulo: "Confira a margem",
        descricao:
          "A coluna Margem é calculada sobre o preço de venda. Abaixo de 15% aparece em amarelo para você reavaliar a precificação.",
      },
    ],
    integracoes: [
      "O custo médio é recalculado sozinho a cada recebimento de compra — não edite na mão.",
      "O preço de venda alimenta o pedido do Comercial automaticamente.",
    ],
    atencao:
      "O sistema recusa preço de venda abaixo do custo médio. Se precisar vender no prejuízo, ajuste o custo primeiro e registre o motivo.",
  },

  estoque: {
    resumo: "Saldo por lote, validade e endereço no armazém.",
    paraQueServe:
      "O coração do controle sanitário. Todo item fica amarrado a um lote com validade e localização física, o que permite rastrear qualquer produto em caso de recolhimento.",
    passos: [
      {
        titulo: "Entenda as colunas de saldo",
        descricao:
          "'Disponível' é o que pode ser vendido. 'Reservado' já está comprometido com pedido aprovado, mas ainda não saiu fisicamente.",
      },
      {
        titulo: "Priorize pela coluna Situação",
        descricao:
          "Vermelho é lote vencido — não pode sair. Amarelo vence em até 30 dias. Azul, em até 90. A lista já vem ordenada por validade.",
      },
      {
        titulo: "Use a localização",
        descricao:
          "O endereço (ex.: RUA-A/PRAT-03/N1) é o que o separador segue para achar o produto. Mantenha atualizado ou a separação atrasa.",
      },
      {
        titulo: "Consulte o histórico",
        descricao:
          "A tabela de baixo é o kardex: toda entrada e saída com o saldo resultante. Serve para auditoria e para achar divergência.",
      },
    ],
    integracoes: [
      "Entradas vêm do recebimento de compras; saídas, da expedição de pedidos.",
      "Os alertas de validade aparecem no dashboard de todo mundo.",
    ],
    atencao:
      "A separação segue FEFO: sai primeiro o lote que vence antes, não o que chegou antes. O sistema escolhe sozinho.",
  },

  fornecedores: {
    resumo: "Quem abastece a distribuidora.",
    paraQueServe:
      "Cadastro dos laboratórios e indústrias, com condições comerciais, prazo de entrega e histórico de quanto já foi comprado de cada um.",
    passos: [
      {
        titulo: "Cadastre com CNPJ válido",
        descricao:
          "O sistema confere os dígitos verificadores e recusa CNPJ inválido. Pode digitar com ou sem pontuação.",
      },
      {
        titulo: "Informe o prazo de entrega",
        descricao:
          "É usado para calcular a previsão de chegada e o vencimento do título no contas a pagar. Prazo errado desalinha o financeiro.",
      },
      {
        titulo: "Registre a condição de pagamento",
        descricao: "Ex.: 30/60/90 dias. Aparece na hora de montar o pedido de compra.",
      },
      {
        titulo: "Acompanhe o total comprado",
        descricao:
          "A coluna mostra o volume acumulado — argumento concreto na hora de negociar desconto.",
      },
    ],
    integracoes: ["Cada compra aprovada gera um título a pagar vinculado ao fornecedor."],
  },

  compras: {
    resumo: "Da necessidade de reposição até a mercadoria no armazém.",
    paraQueServe:
      "Onde Suprimentos monta o pedido, a gerência aprova e a Logística recebe. O sistema acompanha o status do início ao fim e avisa o Financeiro.",
    passos: [
      {
        titulo: "Comece pela sugestão de reposição",
        descricao:
          "O quadro do topo lista o que está abaixo do mínimo e quanto comprar para chegar ao ideal. É o ponto de partida do comprador.",
      },
      {
        titulo: "Monte o pedido",
        descricao:
          "Escolha o fornecedor e adicione os itens. O custo vem preenchido com o último praticado — ajuste se negociou outro valor.",
      },
      {
        titulo: "Envie para aprovação",
        descricao:
          "O pedido nasce aguardando aprovação. Quem tem permissão de aprovar libera — e só então vira compromisso financeiro.",
      },
      {
        titulo: "Receba a mercadoria",
        descricao:
          "Quando o caminhão chega, a Logística clica em 'Receber' e informa lote, validade e endereço de cada item.",
      },
    ],
    integracoes: [
      "Aprovar a compra cria o título no contas a pagar automaticamente.",
      "Receber a mercadoria dá entrada no estoque e recalcula o custo médio do produto.",
    ],
    atencao:
      "Lote e validade são obrigatórios no recebimento, e o sistema recusa lote já vencido. É exigência sanitária, não burocracia.",
  },

  clientes: {
    resumo: "Carteira de clientes e situação de crédito.",
    paraQueServe:
      "Farmácias, drogarias, hospitais e clínicas que compram da distribuidora. Guarda dados cadastrais, limite de crédito e o quanto cada um deve.",
    passos: [
      {
        titulo: "Cadastre com CNPJ e segmento",
        descricao:
          "O segmento (farmácia, hospital, rede...) ajuda a segmentar campanhas e analisar a carteira.",
      },
      {
        titulo: "Defina o limite de crédito",
        descricao:
          "Zero significa sem limite. Qualquer valor acima disso é conferido toda vez que um pedido do cliente vai para aprovação.",
      },
      {
        titulo: "Acompanhe 'Em aberto'",
        descricao:
          "Mostra quanto o cliente deve agora. Em amarelo quando há saldo devedor — olhe antes de liberar venda nova.",
      },
      {
        titulo: "Bloqueie quando necessário",
        descricao:
          "O campo 'bloquear para novas vendas' impede que qualquer pedido desse cliente seja aprovado, sem precisar avisar o time.",
      },
    ],
    integracoes: [
      "O limite de crédito considera os títulos em aberto no Financeiro, não só o pedido atual.",
    ],
    atencao:
      "Bloquear cliente não cancela pedidos já aprovados — só impede novas aprovações. Cancele os pedidos abertos separadamente.",
  },

  pipeline: {
    resumo: "Oportunidades em negociação antes de virarem pedido.",
    paraQueServe:
      "Acompanha prospecção e negociações em andamento. Serve para prever quanto deve entrar de receita e onde as negociações estão travando.",
    passos: [
      {
        titulo: "Cadastre a oportunidade",
        descricao:
          "Pode ser de um cliente já cadastrado ou de um prospect novo — nesse caso use o campo 'nome do prospect'.",
      },
      {
        titulo: "Mova pela etapa certa",
        descricao:
          "Prospecção → Qualificação → Proposta → Negociação → Ganha ou Perdida. A etapa é o que alimenta o funil do topo da tela.",
      },
      {
        titulo: "Ajuste a probabilidade",
        descricao:
          "O valor ponderado (valor × probabilidade) é a previsão realista. Uma proposta de R$ 100 mil a 50% vale R$ 50 mil na previsão.",
      },
      {
        titulo: "Registre o motivo da perda",
        descricao:
          "Ao marcar como perdida, anote o porquê. É o que permite identificar padrão — preço, prazo, concorrente.",
      },
    ],
  },

  pedidos: {
    resumo: "Pedidos de venda, do rascunho à entrega.",
    paraQueServe:
      "A tela mais importante do Comercial. Cada pedido percorre um fluxo com etapas obrigatórias, e o sistema valida estoque e crédito antes de deixar avançar.",
    passos: [
      {
        titulo: "Crie o pedido",
        descricao:
          "Escolha o cliente e adicione os itens. A coluna 'Disponível' mostra o saldo real — em vermelho se não atender a quantidade pedida.",
      },
      {
        titulo: "Envie para aprovação",
        descricao:
          "Aqui o sistema confere três coisas: cliente bloqueado, limite de crédito e estoque. Se alguma falhar, ele explica o motivo e barra.",
      },
      {
        titulo: "Acompanhe o fluxo",
        descricao:
          "Aprovado → Em separação → Conferido → Faturado → Expedido → Em transporte → Entregue. O botão à direita sempre mostra o próximo passo.",
      },
      {
        titulo: "Consulte os detalhes",
        descricao: "O botão 'Detalhes' abre os itens, valores e a etapa atual do pedido.",
      },
    ],
    integracoes: [
      "Aprovar reserva o estoque e abre a ordem de separação para a Logística.",
      "Faturar emite a nota fiscal, gera o título a receber e apura a comissão do vendedor.",
      "Expedir dá baixa no estoque de verdade.",
    ],
    atencao:
      "Depois de faturado o pedido não pode mais ser cancelado — existe documento fiscal. O caminho passa a ser devolução.",
  },

  logistica: {
    resumo: "Separação, conferência, expedição e entrega.",
    paraQueServe:
      "O painel do armazém. Mostra os pedidos aprovados esperando processamento e as entregas em rota.",
    passos: [
      {
        titulo: "Abra a ordem de separação",
        descricao:
          "Clique em 'Separar'. O sistema já indica qual lote pegar (o que vence antes) e o endereço exato na prateleira.",
      },
      {
        titulo: "Registre o que separou",
        descricao:
          "Se pegou quantidade diferente da pedida, informe o valor real. O campo fica amarelo para sinalizar a divergência.",
      },
      {
        titulo: "Faça a conferência",
        descricao:
          "Um segundo conferente valida o que vai sair. É a última barreira antes da nota fiscal.",
      },
      {
        titulo: "Preencha o transporte",
        descricao:
          "Na tabela de expedição, informe transportadora, motorista, placa e código de rastreio.",
      },
    ],
    integracoes: [
      "As ordens aparecem sozinhas quando o Comercial aprova um pedido.",
      "A conferência sem divergência libera o faturamento.",
    ],
    atencao:
      "Se a conferência apontar diferença, o pedido trava e não avança. Resolva a divergência antes — é proteção contra erro de expedição.",
  },

  devolucoes: {
    resumo: "Devoluções e garantias de produtos.",
    paraQueServe:
      "Registra o que o cliente devolveu, por que devolveu, e decide o destino do produto — o que é crítico num produto farmacêutico.",
    passos: [
      {
        titulo: "Abra a solicitação",
        descricao:
          "Informe o cliente, o motivo (avaria, validade, divergência...) e os itens devolvidos.",
      },
      {
        titulo: "Escolha o tipo",
        descricao: "Devolução é retorno de mercadoria. Garantia é defeito de produto — o tratamento é diferente.",
      },
      {
        titulo: "Confira o produto que chegou",
        descricao:
          "Quem tem permissão de aprovar avalia fisicamente o item e aprova ou rejeita.",
      },
      {
        titulo: "Defina o destino",
        descricao:
          "Revenda, descarte, retorno ao fornecedor ou quarentena. A escolha muda o que acontece com o estoque.",
      },
    ],
    integracoes: [
      "Só o destino 'Revenda' devolve o item ao saldo disponível, no lote de origem.",
    ],
    atencao:
      "Descarte, quarentena e retorno ao fornecedor NÃO recompõem o estoque — o produto sai do saldo vendável de propósito.",
  },

  financeiro: {
    resumo: "Contas a pagar e receber, caixa e comissões.",
    paraQueServe:
      "Controla o dinheiro que entra e sai. A maior parte dos títulos nasce sozinha a partir dos pedidos e compras; o lançamento manual é para o resto (aluguel, folha, impostos).",
    passos: [
      {
        titulo: "Navegue pelas abas",
        descricao:
          "Contas a receber, contas a pagar, fluxo de caixa e comissões. Cada uma é uma visão diferente do mesmo dinheiro.",
      },
      {
        titulo: "Filtre por situação",
        descricao:
          "O seletor no topo mostra só em aberto, vencidos ou quitados. Vencidos aparecem em vermelho com os dias de atraso.",
      },
      {
        titulo: "Dê baixa nos títulos",
        descricao:
          "Ao receber ou pagar, clique em 'Dar baixa'. Aceita valor parcial — o título fica como 'Parcial' até quitar.",
      },
      {
        titulo: "Acompanhe a projeção",
        descricao:
          "Na aba Fluxo de caixa, o gráfico mostra o saldo previsto por semana, considerando o que vence a receber e a pagar.",
      },
    ],
    integracoes: [
      "Faturar um pedido gera o título a receber; aprovar uma compra gera o título a pagar.",
      "Toda baixa vira automaticamente um movimento no fluxo de caixa.",
      "As comissões saem sozinhas do faturamento (3% sobre o total).",
    ],
  },

  marketing: {
    resumo: "Campanhas e materiais promocionais.",
    paraQueServe:
      "Planeja e acompanha as ações de divulgação: período, público-alvo, orçamento, produtos envolvidos e resultado.",
    passos: [
      {
        titulo: "Cadastre a campanha",
        descricao: "Nome, canal (redes sociais, e-mail, evento...), público-alvo e período.",
      },
      {
        titulo: "Defina o orçamento",
        descricao:
          "Informe o previsto e vá atualizando o investido. A tela mostra o percentual consumido.",
      },
      {
        titulo: "Vincule os produtos",
        descricao: "Amarra a campanha aos itens promovidos, para depois cruzar com as vendas.",
      },
      {
        titulo: "Registre os resultados",
        descricao: "Ao encerrar, anote o que funcionou. É o histórico para a próxima campanha.",
      },
    ],
  },

  rh: {
    resumo: "Colaboradores, documentos e treinamentos.",
    paraQueServe:
      "Gestão de pessoas: quadro de funcionários, departamentos, cargos, documentos com validade e treinamentos.",
    passos: [
      {
        titulo: "Cadastre o colaborador",
        descricao: "Dados pessoais, matrícula, admissão, departamento e cargo.",
      },
      {
        titulo: "Mantenha a situação em dia",
        descricao:
          "Ativo, férias, afastado ou desligado. A folha mensal considera apenas os ativos.",
      },
      {
        titulo: "Controle os documentos",
        descricao:
          "Contratos, ASOs, certificados e licenças com data de validade — importante para auditoria sanitária.",
      },
      {
        titulo: "Acompanhe os treinamentos",
        descricao:
          "Registre quem participou. Treinamentos obrigatórios (como Boas Práticas de Distribuição) são exigência regulatória.",
      },
    ],
  },

  usuarios: {
    resumo: "Quem acessa o sistema e o que cada um pode fazer.",
    paraQueServe:
      "Administração dos acessos. Cada usuário tem uma área (define quais telas vê) e um perfil (define o que pode fazer nelas).",
    passos: [
      {
        titulo: "Cadastre o usuário",
        descricao:
          "Nome, e-mail corporativo e senha inicial. O e-mail é o login e não pode repetir.",
      },
      {
        titulo: "Escolha a área",
        descricao:
          "Define os módulos visíveis. Alguém do Comercial não enxerga o Financeiro, por exemplo.",
      },
      {
        titulo: "Escolha o perfil",
        descricao:
          "Define as ações: operador vê e edita; analista cria; gerente aprova; administrador exclui.",
      },
      {
        titulo: "Desative em vez de excluir",
        descricao:
          "Ao desligar alguém, desmarque 'usuário ativo'. Preserva o histórico de auditoria das ações que a pessoa fez.",
      },
    ],
    integracoes: ["A matriz no rodapé da tela mostra quais módulos cada área enxerga."],
    atencao:
      "Ao editar, deixe a senha em branco para mantê-la. Só preencha se for realmente trocar.",
  },

  logs: {
    resumo: "Registro de tudo que foi feito no sistema.",
    paraQueServe:
      "Trilha de auditoria. Guarda quem fez o quê e quando — criação, edição, exclusão, aprovação e login. Essencial para investigar divergência.",
    passos: [
      {
        titulo: "Leia a linha do tempo",
        descricao: "Os registros mais recentes vêm primeiro, com data, hora e autor.",
      },
      {
        titulo: "Use as cores das ações",
        descricao:
          "Verde é criação, azul é edição, vermelho é exclusão. Aprovações aparecem destacadas.",
      },
      {
        titulo: "Investigue pelos detalhes",
        descricao:
          "A última coluna traz o contexto — qual pedido mudou de status, qual valor foi baixado.",
      },
    ],
    atencao: "Os registros não podem ser editados nem apagados pela interface, de propósito.",
  },

  relatorios: {
    resumo: "Consultas consolidadas para análise.",
    paraQueServe:
      "Espaço reservado para relatórios gerenciais consolidados. Por enquanto, os números de cada área ficam no dashboard e nas próprias telas.",
    passos: [
      {
        titulo: "Use os indicadores das telas",
        descricao:
          "Cada módulo traz seus próprios cartões consolidados no topo — faturamento, valores em aberto, contagens.",
      },
    ],
  },
};

/** Título amigável de cada módulo, usado no tour e no menu de ajuda. */
export const TITULOS_MODULO: Record<Modulo, string> = {
  dashboard: "Dashboard",
  produtos: "Produtos",
  estoque: "Estoque e lotes",
  fornecedores: "Fornecedores",
  compras: "Compras",
  clientes: "Clientes",
  pipeline: "Pipeline comercial",
  pedidos: "Pedidos de venda",
  logistica: "Logística",
  devolucoes: "Devoluções e garantias",
  financeiro: "Financeiro",
  marketing: "Marketing",
  rh: "Administrativo / RH / DHO",
  usuarios: "Usuários e acessos",
  logs: "Auditoria",
  relatorios: "Relatórios",
};

/** Rota de cada módulo, para o tour poder levar a pessoa até a tela. */
export const ROTAS_MODULO: Record<Modulo, string> = {
  dashboard: "/dashboard",
  produtos: "/produtos",
  estoque: "/estoque",
  fornecedores: "/fornecedores",
  compras: "/compras",
  clientes: "/clientes",
  pipeline: "/pipeline",
  pedidos: "/pedidos",
  logistica: "/logistica",
  devolucoes: "/devolucoes",
  financeiro: "/financeiro",
  marketing: "/marketing",
  rh: "/rh",
  usuarios: "/usuarios",
  logs: "/logs",
  relatorios: "/relatorios",
};

/** O que cada perfil pode fazer, em linguagem de negócio. */
export const O_QUE_O_PERFIL_FAZ: Record<string, string> = {
  ADMINISTRADOR: "Você tem acesso total: vê, cria, edita, aprova e exclui em todos os módulos.",
  PRESIDENCIA: "Você acompanha os números e aprova o que precisa de decisão, sem editar o operacional.",
  DIRETORIA: "Você vê, cria, edita e aprova nos módulos da sua área.",
  GERENTE: "Você vê, cria, edita e aprova nos módulos da sua área.",
  ANALISTA: "Você vê, cria e edita registros. Aprovações ficam com a gerência.",
  OPERADOR: "Você vê e atualiza registros do dia a dia. Criação e aprovação ficam com o time responsável.",
};
