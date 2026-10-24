import type { FaqItem, FeatureItem, PricingOption, StepItem, TestimonialItem } from "./types";

export const proofBadge = "⭐ 4.9/5 · Usado por +1.200 criativos e estúdios";

export const featureItems: FeatureItem[] = [
  {
    icon: "zap",
    title: "Processamento em 288 ms",
    description:
      "Velocidade de placar: cada arte é renderizada em apenas 288 milissegundos, sem espera.",
  },
  {
    icon: "sliders",
    title: "Motor universal para qualquer tecido",
    description:
      "A cor escolhida calcula contraste, underbase e halftone automaticamente, preservando pretos, olhos, cabelos, sombras, textos e detalhes da arte.",
  },
  {
    icon: "package",
    title: "Montagem DTF (gang sheet)",
    description:
      "Monte folhas de 58x100 cm ou tamanho livre, organize automaticamente e exporte em PNG ou PDF no tamanho físico exato.",
  },
  {
    icon: "shield",
    title: "Zoom de impressão em tempo real",
    description:
      "Preview com zoom até 1600% que simula fielmente a retícula escolhida, exatamente como o arquivo final vai imprimir.",
  },
  {
    icon: "save",
    title: "PNG, JPEG, PDF, PSD e imagem por link",
    description:
      "Carregue os principais formatos, cole uma imagem, arraste um arquivo ou importe por link para iniciar a preparação sem etapas extras.",
  },
  {
    icon: "printer",
    title: "Export A2, A3 e A4 em 300 DPI real",
    description:
      "Salve em PNG A4 (2480x3508), A3 (3508x4961) ou A2 (4961x7016) com metadados pHYs cravados em 300 DPI, prontos para DTF.",
  },
];

export const testimonialItems: TestimonialItem[] = [
  {
    name: "Mariana Costa",
    role: "Designer Têxtil",
    avatar: "MC",
    quote:
      "Consegui reduzir o tempo entre aprovação e produção porque o preview mostra exatamente o impacto do halftone.",
  },
  {
    name: "Rafael Nunes",
    role: "Estúdio de Serigrafia",
    avatar: "RN",
    quote:
      "A consistência dos presets ajudou a manter padrão em pedidos recorrentes sem retrabalho no fechamento dos arquivos.",
  },
  {
    name: "Camila Freitas",
    role: "Direção de Arte",
    avatar: "CF",
    quote:
      "A ferramenta entrega velocidade real para testar variações e exportar rápido quando o cliente aprova a arte.",
  },
];

export const steps: StepItem[] = [
  {
    icon: "upload",
    title: "Carregue ou escolha sua arte",
    description:
      "Envie PNG, JPEG, PDF ou PSD, importe por link ou escolha uma imagem organizada na sua Biblioteca de Artes.",
  },
  {
    icon: "adjustments",
    title: "Escolha o tecido e ajuste",
    description:
      "O motor calcula o tratamento para tecido preto, branco ou colorido e permite refinar formato, densidade, ângulo, cor, sombras e brilho.",
  },
  {
    icon: "download",
    title: "Visualize e exporte em 300 DPI",
    description:
      "Confira a retícula em zoom de impressão e baixe o PNG final em A2, A3 ou A4 com tamanho físico e metadados reais de 300 DPI.",
  },
];

export const pricingOptions: PricingOption[] = [
  {
    billing: "mensal",
    label: "Plano Mensal",
    price: "R$ 47",
    cadence: "/mês",
    summary:
      "Ideal para produzir com Halftone, Biblioteca de Artes, Gestão DTF, montagem profissional, mockups e Catálogo em Lote.",
    checkoutHref: "https://nubank.com.br/cobranca/c4gqtgTcme3a2dkq",
    benefits: [
      "Halftone inteligente para qualquer cor de tecido",
      "Exportação em PNG 300 DPI pronto para DTF",
      "Biblioteca, Gestão DTF, montagem e mockups",
      "Catálogo em Lote com mockups e PDF automático",
      "Suporte via WhatsApp",
    ],
  },
  {
    billing: "anual",
    label: "Plano Anual",
    price: "R$ 147",
    cadence: "/ano",
    badge: "Melhor custo anual",
    summary:
      "A melhor escolha para estúdios e produção contínua durante todo o ano, com economia significativa.",
    checkoutHref: "https://nubank.com.br/cobranca/ZA14QIfuv63a2dkq",
    benefits: [
      "Todas as ferramentas da plataforma com economia anual",
      "Acesso contínuo durante 12 meses",
      "Prioridade no suporte via WhatsApp",
      "Ideal para operação comercial recorrente",
    ],
  },
];

export const faqItems: FaqItem[] = [
  {
    question: "Posso usar os halftones em projetos comerciais?",
    answer:
      "Sim. Enquanto o plano estiver ativo, você pode usar os arquivos exportados em projetos comerciais normalmente.",
  },
  {
    question: "Funciona offline?",
    answer:
      "Não. O uso da plataforma depende de conexão online para acessar a ferramenta e o fluxo de liberação.",
  },
  {
    question: "Quais formatos são aceitos?",
    answer:
      "PNG, JPEG, PDF e PSD. Você também pode importar imagens por link e enviar artes da Biblioteca diretamente para o Halftone.",
  },
  {
    question: "A plataforma funciona em qualquer cor de camiseta?",
    answer:
      "Sim. O motor universal usa a cor real do tecido para calcular contraste, underbase e retícula, sem usar a cor da camisa como borracha para apagar detalhes internos.",
  },
  {
    question: "O que está incluído além do Halftone?",
    answer:
      "Biblioteca de Artes, montagem DTF em tamanho livre, estúdio de mockups, Catálogo em Lote (20 a 100 PNGs com mockups e PDF) e Gestão DTF com produção, pedidos, clientes, estoque, financeiro, impostos e relatórios.",
  },
  {
    question: "Como funciona o suporte?",
    answer:
      "O atendimento acontece pelo botão flutuante de WhatsApp para agilizar dúvidas operacionais e comerciais.",
  },
];
