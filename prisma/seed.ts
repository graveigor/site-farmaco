import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SENHA_DEMO, USUARIOS_DEMO } from "../src/lib/demo-users";

const prisma = new PrismaClient();

const SENHA_PADRAO = SENHA_DEMO;

function dias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("Limpando base...");
  // Ordem respeita as dependências de chave estrangeira.
  await prisma.$transaction([
    prisma.itemSeparacao.deleteMany(),
    prisma.separacao.deleteMany(),
    prisma.ocorrenciaEntrega.deleteMany(),
    prisma.entrega.deleteMany(),
    prisma.notaFiscal.deleteMany(),
    prisma.itemDevolucao.deleteMany(),
    prisma.devolucao.deleteMany(),
    prisma.cobranca.deleteMany(),
    prisma.contaReceber.deleteMany(),
    prisma.contaPagar.deleteMany(),
    prisma.movimentoCaixa.deleteMany(),
    prisma.comissao.deleteMany(),
    prisma.itemPedidoVenda.deleteMany(),
    prisma.pedidoVenda.deleteMany(),
    prisma.itemPedidoCompra.deleteMany(),
    prisma.pedidoCompra.deleteMany(),
    prisma.itemCotacao.deleteMany(),
    prisma.cotacao.deleteMany(),
    prisma.solicitacaoCompra.deleteMany(),
    prisma.itemInventario.deleteMany(),
    prisma.inventario.deleteMany(),
    prisma.movimentoEstoque.deleteMany(),
    prisma.historicoPreco.deleteMany(),
    prisma.lote.deleteMany(),
    prisma.campanhaProduto.deleteMany(),
    prisma.materialPromocional.deleteMany(),
    prisma.campanha.deleteMany(),
    prisma.produto.deleteMany(),
    prisma.interacao.deleteMany(),
    prisma.oportunidade.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.fornecedor.deleteMany(),
    prisma.metaComercial.deleteMany(),
    prisma.avaliacao.deleteMany(),
    prisma.treinamentoColaborador.deleteMany(),
    prisma.treinamento.deleteMany(),
    prisma.documento.deleteMany(),
    prisma.colaborador.deleteMany(),
    prisma.cargo.deleteMany(),
    prisma.departamento.deleteMany(),
    prisma.categoriaFinanceira.deleteMany(),
    prisma.logAcao.deleteMany(),
    prisma.usuario.deleteMany(),
  ]);

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

  console.log("Criando usuários...");
  // A lista vive em src/lib/demo-users.ts para que a tela de login e o seed
  // nunca divirjam.
  const usuarios = await Promise.all(
    USUARIOS_DEMO.map((u) => prisma.usuario.create({ data: { ...u, senhaHash } })),
  );

  const admin = usuarios[0];
  const vendedora = usuarios[6];

  console.log("Criando estrutura organizacional...");
  const departamentos = await Promise.all(
    [
      { nome: "Diretoria", area: "DIRETORIA" },
      { nome: "Financeiro", area: "FINANCEIRO" },
      { nome: "Suprimentos", area: "SUPRIMENTOS" },
      { nome: "Marketing", area: "MARKETING" },
      { nome: "Comercial", area: "COMERCIAL" },
      { nome: "Logística", area: "LOGISTICA" },
      { nome: "Administrativo / RH / DHO", area: "ADMINISTRATIVO" },
    ].map((d) => prisma.departamento.create({ data: d })),
  );

  const cargos = await Promise.all([
    prisma.cargo.create({ data: { nome: "Analista de compras", departamentoId: departamentos[2].id, salarioBase: 4800 } }),
    prisma.cargo.create({ data: { nome: "Executivo de vendas", departamentoId: departamentos[4].id, salarioBase: 4200 } }),
    prisma.cargo.create({ data: { nome: "Separador de pedidos", departamentoId: departamentos[5].id, salarioBase: 2600 } }),
    prisma.cargo.create({ data: { nome: "Analista financeiro", departamentoId: departamentos[1].id, salarioBase: 5200 } }),
  ]);

  await Promise.all([
    prisma.colaborador.create({
      data: {
        nome: "Gabriela Souza", cpf: "12345678901", matricula: "0001", email: "vendas@distribuidora.com.br",
        dataAdmissao: new Date("2023-03-06"), salario: 4200, departamentoId: departamentos[4].id,
        cargoId: cargos[1].id, usuarioId: vendedora.id,
      },
    }),
    prisma.colaborador.create({
      data: {
        nome: "Igor Pacheco", cpf: "23456789012", matricula: "0002",
        dataAdmissao: new Date("2024-01-15"), salario: 2600, departamentoId: departamentos[5].id, cargoId: cargos[2].id,
      },
    }),
    prisma.colaborador.create({
      data: {
        nome: "Marcos Vieira", cpf: "34567890123", matricula: "0003",
        dataAdmissao: new Date("2022-08-01"), salario: 5200, departamentoId: departamentos[1].id,
        cargoId: cargos[3].id, status: "FERIAS",
      },
    }),
  ]);

  const treinamento = await prisma.treinamento.create({
    data: {
      nome: "Boas Práticas de Distribuição (BPD)", descricao: "Treinamento regulatório obrigatório — RDC 304/2019.",
      cargaHoraria: 16, obrigatorio: true, dataInicio: dias(-30), dataFim: dias(-28),
    },
  });

  const colaboradores = await prisma.colaborador.findMany();
  await prisma.treinamentoColaborador.createMany({
    data: colaboradores.map((c) => ({ treinamentoId: treinamento.id, colaboradorId: c.id, status: "CONCLUIDO", nota: 9 })),
  });

  console.log("Criando categorias financeiras...");
  await prisma.categoriaFinanceira.createMany({
    data: [
      { nome: "Venda de mercadorias", tipo: "RECEITA" },
      { nome: "Compra de mercadorias", tipo: "DESPESA" },
      { nome: "Folha de pagamento", tipo: "DESPESA" },
      { nome: "Frete e logística", tipo: "DESPESA" },
      { nome: "Marketing", tipo: "DESPESA" },
      { nome: "Impostos", tipo: "DESPESA" },
    ],
  });

  console.log("Criando fornecedores...");
  const fornecedores = await Promise.all(
    [
      { razaoSocial: "Laboratório NeoPharma S.A.", nomeFantasia: "NeoPharma", cnpj: "11222333000181", cidade: "São Paulo", uf: "SP", prazoEntregaDias: 5, condicaoPagamento: "30/60 dias" },
      { razaoSocial: "Genéricos Brasil Indústria Ltda.", nomeFantasia: "GenBrasil", cnpj: "22333444000172", cidade: "Goiânia", uf: "GO", prazoEntregaDias: 10, condicaoPagamento: "28 dias" },
      { razaoSocial: "BioMed Insumos Hospitalares", nomeFantasia: "BioMed", cnpj: "33444555000163", cidade: "Campinas", uf: "SP", prazoEntregaDias: 7, condicaoPagamento: "45 dias" },
    ].map((f) => prisma.fornecedor.create({ data: { ...f, email: "comercial@fornecedor.com.br", telefone: "(11) 4000-0000" } })),
  );

  console.log("Criando produtos...");
  const definicoes = [
    { sku: "MED-0001", nomeComercial: "Dipirona Sódica 500mg", principioAtivo: "Dipirona sódica", categoria: "Analgésico", fabricante: "NeoPharma", custo: 8.4, preco: 14.9, min: 200, max: 1200 },
    { sku: "MED-0002", nomeComercial: "Amoxicilina 500mg", principioAtivo: "Amoxicilina", categoria: "Antibiótico", fabricante: "GenBrasil", custo: 18.2, preco: 32.5, min: 150, max: 800, receita: true },
    { sku: "MED-0003", nomeComercial: "Losartana Potássica 50mg", principioAtivo: "Losartana potássica", categoria: "Anti-hipertensivo", fabricante: "GenBrasil", custo: 11.7, preco: 21.9, min: 300, max: 1500 },
    { sku: "MED-0004", nomeComercial: "Omeprazol 20mg", principioAtivo: "Omeprazol", categoria: "Inibidor de bomba", fabricante: "NeoPharma", custo: 9.9, preco: 18.4, min: 250, max: 1000 },
    { sku: "MED-0005", nomeComercial: "Clonazepam 2mg", principioAtivo: "Clonazepam", categoria: "Ansiolítico", fabricante: "NeoPharma", custo: 14.3, preco: 27.8, min: 80, max: 400, receita: true, controlado: true },
    { sku: "MED-0006", nomeComercial: "Metformina 850mg", principioAtivo: "Cloridrato de metformina", categoria: "Antidiabético", fabricante: "GenBrasil", custo: 12.1, preco: 22.4, min: 200, max: 900 },
    { sku: "INS-0001", nomeComercial: "Seringa Descartável 5ml", categoria: "Insumo hospitalar", fabricante: "BioMed", custo: 0.62, preco: 1.35, min: 2000, max: 10000 },
    { sku: "INS-0002", nomeComercial: "Luva de Procedimento M (cx 100)", categoria: "Insumo hospitalar", fabricante: "BioMed", custo: 24.5, preco: 41.9, min: 100, max: 600 },
  ];

  const produtos = await Promise.all(
    definicoes.map((d, i) =>
      prisma.produto.create({
        data: {
          sku: d.sku, nomeComercial: d.nomeComercial, principioAtivo: d.principioAtivo ?? null,
          categoria: d.categoria, fabricante: d.fabricante, custoMedio: d.custo, precoVenda: d.preco,
          estoqueMinimo: d.min, estoqueMaximo: d.max, unidadeMedida: d.sku.startsWith("INS") ? "UN" : "CX",
          ncm: "3004.90.99", exigeReceita: d.receita ?? false, controlado: d.controlado ?? false,
          registroAnvisa: `1.${String(1000 + i)}.0001.001-${i}`,
          fornecedorId: fornecedores[i % fornecedores.length].id,
        },
      }),
    ),
  );

  console.log("Criando lotes com validades variadas...");
  // Mistura proposital: lotes saudáveis, próximos do vencimento e vencidos,
  // para exercitar os alertas do dashboard.
  const planoLotes: { produto: number; codigo: string; validade: number; qtd: number; local: string }[] = [
    { produto: 0, codigo: "L2601A", validade: 420, qtd: 900, local: "RUA-A/PRAT-01/N1" },
    { produto: 0, codigo: "L2512B", validade: 25, qtd: 120, local: "RUA-A/PRAT-01/N2" },
    { produto: 1, codigo: "L2604C", validade: 380, qtd: 500, local: "RUA-A/PRAT-03/N1" },
    { produto: 2, codigo: "L2603D", validade: 300, qtd: 1100, local: "RUA-B/PRAT-02/N1" },
    { produto: 2, codigo: "L2509E", validade: -12, qtd: 40, local: "QUARENTENA" },
    { produto: 3, codigo: "L2607F", validade: 500, qtd: 760, local: "RUA-B/PRAT-04/N2" },
    { produto: 4, codigo: "L2602G", validade: 210, qtd: 60, local: "COFRE-CONTROLADOS" },
    { produto: 5, codigo: "L2605H", validade: 88, qtd: 180, local: "RUA-C/PRAT-01/N1" },
    { produto: 6, codigo: "L2610I", validade: 700, qtd: 8000, local: "RUA-D/PRAT-01/N1" },
    { produto: 7, codigo: "L2608J", validade: 640, qtd: 85, local: "RUA-D/PRAT-03/N2" },
  ];

  for (const l of planoLotes) {
    const produto = produtos[l.produto];
    const lote = await prisma.lote.create({
      data: {
        produtoId: produto.id, codigo: l.codigo, dataValidade: dias(l.validade),
        dataFabricacao: dias(l.validade - 730), quantidade: l.qtd,
        custoUnitario: produto.custoMedio, localizacao: l.local,
      },
    });
    await prisma.movimentoEstoque.create({
      data: {
        produtoId: produto.id, loteId: lote.id, tipo: "ENTRADA", quantidade: l.qtd,
        saldoApos: l.qtd, origem: "CARGA_INICIAL", motivo: "Carga inicial de estoque", usuarioId: admin.id,
      },
    });
  }

  console.log("Criando clientes...");
  const clientes = await Promise.all(
    [
      { razaoSocial: "Drogaria Vida Plena Ltda.", nomeFantasia: "Vida Plena", cnpj: "44555666000154", segmento: "DROGARIA", limiteCredito: 80000, cidade: "São Paulo", uf: "SP" },
      { razaoSocial: "Rede Farmacêutica Bem Estar S.A.", nomeFantasia: "Bem Estar", cnpj: "55666777000145", segmento: "REDE", limiteCredito: 250000, cidade: "Santos", uf: "SP" },
      { razaoSocial: "Hospital Santa Clara", cnpj: "66777888000136", segmento: "HOSPITAL", limiteCredito: 400000, cidade: "Campinas", uf: "SP" },
      { razaoSocial: "Clínica Reviver Ltda.", cnpj: "77888999000127", segmento: "CLINICA", limiteCredito: 45000, cidade: "Ribeirão Preto", uf: "SP" },
      { razaoSocial: "Farmácia Popular Central", cnpj: "88999000000118", segmento: "FARMACIA", limiteCredito: 20000, cidade: "Sorocaba", uf: "SP", bloqueado: true },
    ].map((c) => prisma.cliente.create({ data: { ...c, email: "compras@cliente.com.br", telefone: "(11) 3000-0000", condicaoPagamento: "28 dias" } })),
  );

  console.log("Criando pipeline comercial...");
  await Promise.all([
    prisma.oportunidade.create({ data: { titulo: "Contrato anual — Rede Bem Estar", clienteId: clientes[1].id, etapa: "NEGOCIACAO", valorEstimado: 320000, probabilidade: 70, responsavelId: vendedora.id, previsaoFechamento: dias(45) } }),
    prisma.oportunidade.create({ data: { titulo: "Licitação Hospital Santa Clara", clienteId: clientes[2].id, etapa: "PROPOSTA", valorEstimado: 180000, probabilidade: 50, responsavelId: vendedora.id, previsaoFechamento: dias(30) } }),
    prisma.oportunidade.create({ data: { titulo: "Prospect — Drogarias União", prospectNome: "Drogarias União", etapa: "PROSPECCAO", valorEstimado: 60000, probabilidade: 20, responsavelId: vendedora.id } }),
    prisma.oportunidade.create({ data: { titulo: "Expansão Vida Plena", clienteId: clientes[0].id, etapa: "GANHA", valorEstimado: 95000, probabilidade: 100, responsavelId: vendedora.id } }),
  ]);

  console.log("Criando campanha de marketing...");
  const campanha = await prisma.campanha.create({
    data: {
      nome: "Campanha Genéricos — 2º semestre", descricao: "Impulsionar linha de genéricos junto a redes e drogarias.",
      canal: "REDES_SOCIAIS", publicoAlvo: "Drogarias e redes regionais", orcamento: 45000, investido: 18500,
      dataInicio: dias(-40), dataFim: dias(50), status: "EM_ANDAMENTO",
      produtos: { create: [{ produtoId: produtos[1].id }, { produtoId: produtos[2].id }, { produtoId: produtos[5].id }] },
      materiais: { create: [{ nome: "Banner digital 1080x1080", tipo: "POST" }, { nome: "Folder linha genéricos", tipo: "FOLDER" }] },
    },
  });
  console.log(`  campanha ${campanha.nome}`);

  console.log("Criando pedidos de venda em diferentes etapas do fluxo...");
  // Pedidos históricos já faturados, para alimentar gráficos e financeiro.
  for (let i = 0; i < 6; i++) {
    const cliente = clientes[i % 3];
    const produto = produtos[i % produtos.length];
    const quantidade = 20 + i * 7;
    const total = quantidade * produto.precoVenda;
    const faturadoEm = dias(-(i * 22 + 5));

    const pedido = await prisma.pedidoVenda.create({
      data: {
        numero: `PV-2026-${String(100 + i).padStart(4, "0")}`,
        clienteId: cliente.id, vendedorId: vendedora.id, status: "ENTREGUE",
        subtotal: total, valorTotal: total, prazoDias: 28,
        aprovadoEm: faturadoEm, faturadoEm, expedidoEm: faturadoEm, entregueEm: dias(-(i * 22)),
        itens: { create: [{ produtoId: produto.id, quantidade, precoUnitario: produto.precoVenda, total }] },
      },
    });

    await prisma.notaFiscal.create({
      data: { numero: String(1000 + i), pedidoVendaId: pedido.id, valorTotal: total, emitidaEm: faturadoEm },
    });

    // Alguns títulos ficam em aberto/vencidos para exercitar a inadimplência.
    const quitado = i > 1;
    await prisma.contaReceber.create({
      data: {
        descricao: `Pedido ${pedido.numero} - NF ${1000 + i}`, clienteId: cliente.id, pedidoVendaId: pedido.id,
        valor: total, valorRecebido: quitado ? total : 0, vencimento: dias(-(i * 22) + 28),
        status: quitado ? "RECEBIDA" : "ABERTA", recebimentoEm: quitado ? dias(-(i * 22) + 30) : null,
        documento: String(1000 + i),
      },
    });

    await prisma.comissao.create({
      data: {
        usuarioId: vendedora.id, pedidoVendaId: pedido.id, baseCalculo: total, percentual: 3,
        valor: total * 0.03, status: quitado ? "PAGA" : "PENDENTE", competencia: faturadoEm.toISOString().slice(0, 7),
      },
    });
  }

  // Pedido aguardando aprovação — exercita a fila do Comercial.
  const produtoA = produtos[0];
  await prisma.pedidoVenda.create({
    data: {
      numero: "PV-2026-0200", clienteId: clientes[0].id, vendedorId: vendedora.id, status: "AGUARDANDO_APROVACAO",
      subtotal: 30 * produtoA.precoVenda, valorTotal: 30 * produtoA.precoVenda, prazoDias: 28,
      itens: { create: [{ produtoId: produtoA.id, quantidade: 30, precoUnitario: produtoA.precoVenda, total: 30 * produtoA.precoVenda }] },
    },
  });

  // Pedido em rascunho.
  const produtoB = produtos[3];
  await prisma.pedidoVenda.create({
    data: {
      numero: "PV-2026-0201", clienteId: clientes[3].id, vendedorId: vendedora.id, status: "RASCUNHO",
      subtotal: 15 * produtoB.precoVenda, valorTotal: 15 * produtoB.precoVenda, prazoDias: 30,
      itens: { create: [{ produtoId: produtoB.id, quantidade: 15, precoUnitario: produtoB.precoVenda, total: 15 * produtoB.precoVenda }] },
    },
  });

  console.log("Criando compras...");
  const solicitacao = await prisma.solicitacaoCompra.create({
    data: { numero: "SC-2026-0001", descricao: "Reposição de antibióticos e anti-hipertensivos", status: "APROVADA", solicitanteId: usuarios[3].id },
  });

  const pedidoCompra = await prisma.pedidoCompra.create({
    data: {
      numero: "PC-2026-0001", fornecedorId: fornecedores[1].id, solicitacaoId: solicitacao.id,
      status: "APROVADO", compradorId: usuarios[3].id, aprovadorId: usuarios[1].id, aprovadoEm: dias(-6),
      previsaoEntrega: dias(4),
      valorTotal: 400 * produtos[1].custoMedio + 600 * produtos[2].custoMedio,
      itens: {
        create: [
          { produtoId: produtos[1].id, quantidade: 400, precoUnitario: produtos[1].custoMedio },
          { produtoId: produtos[2].id, quantidade: 600, precoUnitario: produtos[2].custoMedio },
        ],
      },
    },
  });

  await prisma.contaPagar.create({
    data: {
      descricao: `Compra ${pedidoCompra.numero} - ${fornecedores[1].razaoSocial}`,
      fornecedorId: fornecedores[1].id, pedidoCompraId: pedidoCompra.id,
      valor: pedidoCompra.valorTotal, vencimento: dias(28), documento: pedidoCompra.numero,
    },
  });

  await prisma.pedidoCompra.create({
    data: {
      numero: "PC-2026-0002", fornecedorId: fornecedores[2].id, status: "AGUARDANDO_APROVACAO",
      compradorId: usuarios[3].id, previsaoEntrega: dias(12),
      valorTotal: 3000 * produtos[6].custoMedio,
      itens: { create: [{ produtoId: produtos[6].id, quantidade: 3000, precoUnitario: produtos[6].custoMedio }] },
    },
  });

  console.log("Criando despesas e devoluções...");
  await prisma.contaPagar.createMany({
    data: [
      { descricao: "Folha de pagamento — competência atual", valor: 148000, vencimento: dias(5) },
      { descricao: "Frete distribuição regional", valor: 12400, vencimento: dias(-3) },
      { descricao: "Impostos sobre faturamento", valor: 38900, vencimento: dias(12) },
    ],
  });

  const pedidoDevolucao = await prisma.pedidoVenda.findFirst({ where: { status: "ENTREGUE" }, include: { itens: true } });
  if (pedidoDevolucao) {
    await prisma.devolucao.create({
      data: {
        numero: "DEV-2026-0001", clienteId: pedidoDevolucao.clienteId, pedidoVendaId: pedidoDevolucao.id,
        tipo: "DEVOLUCAO", motivo: "AVARIA", descricao: "Caixas danificadas no transporte.",
        status: "EM_CONFERENCIA", valorTotal: 3 * pedidoDevolucao.itens[0].precoUnitario,
        itens: {
          create: [{ produtoId: pedidoDevolucao.itens[0].produtoId, quantidade: 3, precoUnitario: pedidoDevolucao.itens[0].precoUnitario }],
        },
      },
    });
  }

  console.log("Criando metas comerciais...");
  const agora = new Date();
  await prisma.metaComercial.create({
    data: { usuarioId: vendedora.id, ano: agora.getFullYear(), mes: agora.getMonth() + 1, valorMeta: 120000 },
  });

  console.log("\n=== Base populada com sucesso ===");
  console.log(`Senha para todos os usuários: ${SENHA_PADRAO}\n`);
  for (const u of usuarios) console.log(`  ${u.email.padEnd(38)} ${u.perfil} / ${u.area}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
