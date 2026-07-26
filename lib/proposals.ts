// Modelos de proposta comercial da DRR, por tipo de serviço.
// Os textos seguem o padrão das propostas emitidas pela empresa — servem como
// ponto de partida e podem ser editados em cada proposta.

export const PROPOSAL_TYPES = [
  "INSPECAO",
  "MANUTENCAO",
  "MATERIAL",
  "MONTAGEM",
  "REMANEJAMENTO",
  "DESMONTAGEM",
  "SUPERVISAO",
  "PROJETO",
  "LOCACAO",
] as const;

export type ProposalTypeId = (typeof PROPOSAL_TYPES)[number];

export const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  INSPECAO: "Inspeção e laudo (ART)",
  MANUTENCAO: "Manutenção de estruturas",
  MATERIAL: "Fornecimento de material",
  MONTAGEM: "Montagem de estruturas",
  REMANEJAMENTO: "Remanejamento",
  DESMONTAGEM: "Desmontagem / montagem",
  SUPERVISAO: "Supervisão de obra (ART)",
  PROJETO: "Projeto / engenharia",
  LOCACAO: "Locação de equipamentos",
};

// Prefixo usado na numeração das propostas (ex.: OR-MO-26.189-R0).
export const PROPOSAL_TYPE_PREFIX: Record<string, string> = {
  MANUTENCAO: "OR-MO-",
};

// Dados fixos do rodapé/assinatura.
export const COMPANY = {
  name: "DRR Projetos",
  tagline: "Storage Tecnology",
  city: "São Paulo - SP",
  phone: "(11) 9 9117-9180",
  email: "drrprojetos@drrprojetos.com.br",
  site: "www.drrprojetos.com.br",
};

export type ProposalTemplate = {
  title: string;
  intro: string;
  scope: string;
  included: string;
  notes: string;
  amountLabel: string;
  deadline: string;
  paymentTerms: string;
  taxes: string;
};

// Texto de normas usado nas propostas técnicas.
const NORMAS =
  "Para a realização deste serviço serão aplicadas as orientações das normas técnicas " +
  "NBR 17150, NBR 15524-2, FEM 10.2.02/10.2.03/10.3.01, NBR 14762 e demais pertinentes.";

// Tabela de normas aplicadas (opcional na proposta — padrão das propostas de
// manutenção/fornecimento da DRR).
export const NORMAS_TABLE: { code: string; title: string; origin: string; goal: string }[] = [
  { code: "AISI – LRFD", title: "Cold Formed Steel Design Manual", origin: "Estados Unidos", goal: "Dimensionamento" },
  { code: "ANSI MH 16.2-1984", title: "For the use of industrial and commercial steel storage racks — Manual of safety practices", origin: "Estados Unidos", goal: "Parâmetros de segurança e utilização" },
  { code: "ANSI MH 28.1-1982", title: "Specification for the design, testing, utilization and application of industrial grade steel shelving", origin: "Estados Unidos", goal: "Parâmetros de segurança e utilização" },
  { code: "AWS D 1.1", title: "Structural Welding Code — Steel", origin: "Estados Unidos", goal: "Procedimentos de solda" },
  { code: "FEM 10.2.02", title: "Recomendações para o projeto estático de porta paletes paletizável e manual", origin: "Europa", goal: "Parâmetros de projeto e utilização" },
  { code: "FEM 10.2.03", title: "Recomendações para o aprovisionamento e utilização com segurança de equipamentos de armazenagem", origin: "Europa", goal: "Parâmetros de segurança e utilização" },
  { code: "FEM 10.3.01", title: "Recomendações para o porta paletes de paletização ajustável (APR) — tolerâncias, deformações e folgas", origin: "Europa", goal: "Parâmetros de projeto e utilização" },
  { code: "NBR 14762", title: "Dimensionamento de estruturas de aço constituídas por perfis formados a frio", origin: "Brasil", goal: "Dimensionamento" },
  { code: "NBR 17150", title: "Sistemas de armazenagem — diretrizes para o uso de estruturas tipo porta-paletes seletivos", origin: "Brasil", goal: "Parâmetros de projeto e utilização" },
  { code: "P-NB-117", title: "Cálculo e execução de estruturas de aço soldadas", origin: "Brasil", goal: "Procedimentos de solda" },
  { code: "RMI", title: "Specification for the design, testing and utilization of industrial steel storage racks", origin: "Estados Unidos", goal: "Parâmetros de projeto e utilização" },
];

// Observações gerais padrão dos serviços de montagem/desmontagem (extraídas
// das propostas reais da DRR).
const OBS_MONTAGEM = `A resistência e o nivelamento do piso, assim como a desobstrução das áreas de trabalho, são de responsabilidade do cliente.
Caso haja desnível acima do especificado em norma, serão utilizadas placas de nivelamento, não inclusas no valor da proposta.
É de responsabilidade do cliente o descarregamento e a movimentação dos materiais, assim como a disponibilização de: vestiário e banheiros; pontos de energia (industrial) no local de instalação; pontos de água potável.
Nossa proposta (exceto quando especificado) contempla o fornecimento de todos os equipamentos e insumos necessários para a execução completa do serviço: parafusadeiras e lixadeiras; EPIs e uniformes; chumbadores e parafusos.
Não está contemplado nenhum tipo de obra civil, elétrica ou quaisquer ajustes e materiais não especificados no ato do fechamento do pedido.
Por via de regra, nossa equipe não utiliza plataformas de manutenção na montagem de sistemas de armazenagem convencionais; caso haja necessidade do uso de plataformas, tal exigência deve ser previamente comunicada e expressamente acordada, pois haverá alteração no prazo e no custo.
O horário de trabalho compreende o normal regido pela CLT e segue o acordo coletivo da categoria, de segunda a quinta-feira das 8h às 18h e sexta-feira das 8h às 17h, com uma hora de almoço.
Para serviços efetuados aos finais de semana, feriados e/ou fora do horário acima estipulado serão cobrados valores adicionais referentes às horas extras, mediante anuência expressa e por escrito.`;

const TEMPLATES: Record<ProposalTypeId, ProposalTemplate> = {
  INSPECAO: {
    title: "INSPEÇÃO E LAUDO",
    intro:
      "Segue nossa proposta para inspeção e laudo das estruturas porta paletes existentes na unidade do cliente, como segue.",
    scope: `INSPEÇÃO COM ART (NBR 17.150/2024 — inspeção anual).

Contratação de serviço de engenharia especializado para inspecionar as condições dos componentes das estruturas porta paletes existentes e em uso.

O serviço consiste em vistoriar minuciosamente "in loco" todos os componentes que integram as estruturas porta paletes da unidade e setor citados.

PONTOS AVALIADOS
• Falta de verticalidade, alinhamento e prumo
• Estabilidade transversal e longitudinal
• Efetividade de calços, bases e chumbadores
• Efetividade das travas de segurança
• Componentes danificados ou deformados
• Amarrações
• Condições dos paletes e/ou cargas armazenadas
• Estabilidade das unidades de carga
• Deformações às cargas atuantes

DOCUMENTOS FORNECIDOS
• Relatório fotográfico da inspeção realizada, informando as não conformidades identificadas
• Grau das gravidades identificadas, informando os endereços para fácil localização dos componentes danificados
• Fornecimento de ART (Anotação de Responsabilidade Técnica) pertinente ao serviço contratado

${NORMAS}`,
    included: `ART referente ao serviço executado
Relatório fotográfico e laudo técnico
Todos os impostos
Todos os EPI's para execução do serviço`,
    notes: `O horário de trabalho dos técnicos e engenheiros atende o regido pela CLT e dissídio coletivo da categoria, de segunda a sexta-feira. Serviços fora do horário normal terão cobrança adicional de horas extras.
Caso seja necessária a retirada de dispositivos das estruturas porta paletes para a realização da inspeção, este serviço deverá ser realizado pelo cliente.
O cliente deverá fornecer os documentos pertinentes às inspeções e manutenções realizadas anteriormente, para análise dos porta paletes inspecionados.
O cliente deverá fornecer a plataforma pantográfica (PTA) para a inspeção dos níveis superiores das estruturas.`,
    amountLabel: "VALOR PARA INSPEÇÃO DOS CONJUNTOS",
    deadline: "15 dias.",
    paymentTerms: "100% a 45 dias da data do término dos serviços.",
    taxes: "Inclusos todos os impostos.",
  },

  MANUTENCAO: {
    title: "FORNECIMENTO DE MÃO DE OBRA PARA MANUTENÇÃO",
    intro:
      "Segue nossa proposta para manutenção das estruturas porta paletes existentes na unidade do cliente, conforme solicitado por V.Sa.",
    scope: `SERVIÇOS DE MÃO DE OBRA

Execução dos serviços de reposicionamento, troca e instalação de componentes das estruturas porta paletes, conforme relação de não conformidades levantada em inspeção.

Os componentes a serem fornecidos e/ou substituídos estão relacionados na tabela de itens desta proposta.

${NORMAS}`,
    included: `Imposto — 5% de ISS sobre a mão de obra
Plataforma elevatória (PTA) para a execução dos serviços
Despesas — transporte e alimentação da equipe de manutenção
ART referente aos serviços de manutenção executados, em conformidade com a NBR 17150
Todos os EPI's para execução do serviço`,
    notes: `A retirada dos paletes armazenados nas estruturas porta paletes é de responsabilidade do cliente; nossa equipe não está autorizada a movimentar paletes acondicionados nas estruturas ou nos corredores.
O horário de trabalho compreende o normal regido pela CLT e acordo coletivo da categoria: de segunda a quinta-feira das 8h às 17h e sexta-feira das 8h às 16h, com uma hora de almoço.
Para serviços em finais de semana, feriados e/ou fora do horário estipulado serão cobrados valores adicionais de horas extras, mediante anuência expressa e por escrito.
Caso haja perda de um dia de trabalho por razões não imputáveis à DRR Projetos, será cobrado R$ 750,00 por pessoa/dia, acrescido de eventuais custos de transporte e hospedagem, ou R$ 150,00 por hora em paralisações parciais.`,
    amountLabel: "VALOR TOTAL DOS SERVIÇOS",
    deadline: "35 dias úteis a contar da data do início dos serviços.",
    paymentTerms: `Fabricação — 40% de sinal, saldo 60 dias da data da confirmação do pedido.
Mão de obra — 20% de sinal, saldo 30/60/90 dias da data da confirmação do pedido.`,
    taxes: `ISS — 5% incluso sobre a mão de obra.
ICMS — 18% a incluir sobre o valor dos materiais.
IPI — 3,5% a incluir sobre o valor dos materiais.`,
  },

  MATERIAL: {
    title: "FORNECIMENTO DE COMPONENTES",
    intro:
      "Segue nossa proposta para fornecimento dos componentes relacionados abaixo, conforme solicitado por V.Sa.",
    scope: `COMPONENTES

Fornecimento dos componentes relacionados na tabela de itens desta proposta, fabricados conforme padrão e normas técnicas aplicáveis às estruturas de armazenagem.

TRATAMENTO DE SUPERFÍCIE, PINTURA E CORES
O processo da linha de tratamento de superfície é composto pela remoção de carepa de laminação e óxidos existentes nas chapas. Nas etapas de banho são utilizados desengraxantes ácidos de composição orgânica; após, recebe camada de pintura eletrostática a pó com no mínimo 40 mícron.
Cores: longarinas laranja · itens de segurança (protetores e amarração) amarelo · demais galvanizado.`,
    included: `ART referente aos componentes fornecidos
Garantia de 12 meses contra defeitos de fabricação`,
    notes: `O cliente fica responsável pela descarga do material e se compromete a disponibilizar área para a execução da montagem, junto ao local do serviço.
A movimentação dos materiais dentro da obra é por conta do cliente, quando os mesmos estiverem afastados do local da obra.`,
    amountLabel: "VALOR TOTAL DOS COMPONENTES",
    deadline: "30 dias úteis da data da confirmação do pedido (fabricação).",
    paymentTerms: "100% a 45 dias da data da confirmação do pedido.",
    taxes: `ICMS e IPI a incluir sobre o valor dos materiais, conforme legislação vigente.`,
  },

  MONTAGEM: {
    title: "MONTAGEM DE ESTRUTURAS",
    intro:
      "Segue nossa proposta para fornecimento e montagem das estruturas de armazenagem, conforme solicitado por V.Sa.",
    scope: `SERVIÇOS DE MONTAGEM

Fornecimento de mão de obra especializada, ferramental e supervisão para a montagem das estruturas porta paletes, conforme projeto aprovado e relação de materiais desta proposta.

Escopo dos serviços:
• Conferência e recebimento dos materiais no local da obra
• Marcação e alinhamento das estruturas conforme projeto
• Montagem dos conjuntos, nivelamento, prumo e fixação (chumbadores)
• Instalação dos itens de segurança (protetores, travas e amarrações)
• Limpeza da área e retirada de embalagens ao término dos serviços

${NORMAS}`,
    included: `ART referente aos serviços de montagem executados
Ferramental e equipamentos da equipe de montagem (parafusadeiras, lixadeiras)
Chumbadores e parafusos
Despesas — transporte e alimentação da equipe
Todos os EPI's e uniformes`,
    notes: OBS_MONTAGEM,
    amountLabel: "VALOR TOTAL DA MONTAGEM",
    deadline: "A definir conforme cronograma aprovado, a contar do início dos serviços.",
    paymentTerms: `Fabricação — 40% de sinal, saldo 60 dias da data da confirmação do pedido.
Mão de obra — 20% de sinal, saldo 30/60/90 dias da data da confirmação do pedido.`,
    taxes: `ISS — 5% incluso sobre a mão de obra.
ICMS — 18% a incluir sobre o valor dos materiais.
IPI — 3,5% a incluir sobre o valor dos materiais.`,
  },

  REMANEJAMENTO: {
    title: "REMANEJAMENTO DE ESTRUTURAS",
    intro:
      "Segue nossa proposta para remanejamento das estruturas porta paletes existentes, conforme solicitado por V.Sa.",
    scope: `SERVIÇOS DE REMANEJAMENTO

Fornecimento de mão de obra especializada para desmontagem, movimentação e remontagem das estruturas existentes na nova configuração/layout.

Escopo dos serviços:
• Desmontagem criteriosa dos conjuntos existentes, preservando os componentes
• Separação e triagem dos componentes reaproveitáveis e danificados
• Movimentação interna dos materiais até o novo local
• Remontagem conforme novo layout, com nivelamento, prumo e fixação
• Instalação dos itens de segurança e conferência final

${NORMAS}`,
    included: `ART referente aos serviços executados
Plataforma elevatória (PTA) para a execução dos serviços
Despesas — transporte e alimentação da equipe
Todos os EPI's para execução do serviço`,
    notes: `A retirada dos paletes e cargas armazenadas nas estruturas é de responsabilidade do cliente antes do início dos serviços.
O cliente deverá disponibilizar a área de destino livre, desimpedida e nivelada.
Componentes danificados identificados durante a desmontagem serão relacionados em proposta complementar de fornecimento.
Serviços em finais de semana, feriados e/ou fora do horário normal terão cobrança adicional de horas extras, mediante anuência expressa e por escrito.`,
    amountLabel: "VALOR TOTAL DO REMANEJAMENTO",
    deadline: "A definir conforme cronograma aprovado, a contar do início dos serviços.",
    paymentTerms: "20% de sinal, saldo 30/60/90 dias da data da confirmação do pedido.",
    taxes: "ISS — 5% incluso sobre a mão de obra.",
  },

  DESMONTAGEM: {
    title: "DESMONTAGEM E MONTAGEM DE ESTRUTURAS",
    intro:
      "Apresentamos nossa proposta para desmontagem e montagem de estruturas porta paletes, conforme informações fornecidas.",
    scope: `DESCRIÇÃO

A.1. Mão de obra para desmontagem de estrutura porta palete, conforme configuração informada (altura, níveis de carregamento e quantidade de conjuntos/módulos).

A.2. Mão de obra para montagem de estrutura porta palete na nova configuração, incluindo nivelamento, prumo, fixação e instalação dos itens de segurança.

Descreva aqui a configuração:
• Conjuntos simples: quantidade e módulos
• Conjuntos duplos: quantidade e módulos
• Altura e níveis de carregamento

${NORMAS}`,
    included: `Ferramental e equipamentos da equipe (parafusadeiras, lixadeiras)
Chumbadores e parafusos
EPIs e uniformes`,
    notes: OBS_MONTAGEM,
    amountLabel: "VALOR TOTAL DO SERVIÇO",
    deadline: "Desmontagem e montagem — 10 dias.",
    paymentTerms: "50% na confirmação, saldo 30 dias da data do término dos serviços.",
    taxes: "Incluso.",
  },

  SUPERVISAO: {
    title: "SUPERVISÃO DE FABRICAÇÃO E MONTAGEM",
    intro:
      "Segue nossa proposta para supervisionar a fabricação e montagem de estruturas porta paletes, como segue.",
    scope: `SUPERVISÃO COM ART

Serviço de supervisão de fabricação e montagem com emissão de relatório final de obra com ART, referente às estruturas fabricadas e instaladas por empresa contratada pelo cliente.

SUPERVISÃO — FABRICAÇÃO
• Matérias-primas aplicadas
• Qualidade dos componentes
• Análise das resistências dos componentes
• Acabamento dos componentes

SUPERVISÃO — MONTAGEM
• Falta de verticalidade, alinhamento e prumo
• Estabilidade transversal e longitudinal
• Efetividade de calços, bases e chumbadores
• Efetividade das travas de segurança
• Amarrações

DOCUMENTOS FORNECIDOS
• Relatório completo com todas as especificações pertinentes à obra
• Fornecimento de ART (Anotação de Responsabilidade Técnica) pertinente ao serviço contratado

${NORMAS}`,
    included: `ART referente ao serviço contratado
Relatório final de obra
Todos os impostos`,
    notes: `O cliente deverá informar o cronograma de fabricação e montagem com antecedência para a programação das visitas de supervisão.
O acesso da supervisão à fábrica e à obra deverá ser garantido pelo cliente junto à empresa contratada.`,
    amountLabel: "VALOR TOTAL PARA SUPERVISÃO DE FABRICAÇÃO E MONTAGEM",
    deadline: "Término da obra.",
    paymentTerms: "40% na contratação, saldo a 15 dias do término dos serviços.",
    taxes: "Incluso no preço.",
  },

  PROJETO: {
    title: "PROJETO E ENGENHARIA",
    intro:
      "Segue nossa proposta para elaboração do projeto das estruturas de armazenagem, conforme solicitado por V.Sa.",
    scope: `SERVIÇOS DE ENGENHARIA

Elaboração de projeto de layout e dimensionamento das estruturas de armazenagem, contemplando:
• Levantamento das condições e medidas do local
• Estudo de layout e otimização das posições-palete
• Dimensionamento estrutural conforme normas aplicáveis
• Desenhos técnicos (planta, cortes e detalhes) para aprovação
• Relação de materiais (lista técnica) para fabricação
• Fornecimento de ART do projeto

${NORMAS}`,
    included: `ART referente ao projeto elaborado
Desenhos técnicos em PDF e uma revisão de ajuste após a aprovação preliminar
Relação de materiais para fabricação`,
    notes: `O cliente deverá fornecer as informações e medidas necessárias do local, bem como as características das cargas a serem armazenadas.
Revisões adicionais às previstas nesta proposta serão orçadas à parte.
O projeto executivo só será liberado para fabricação após aprovação formal do cliente.`,
    amountLabel: "VALOR DO PROJETO",
    deadline: "A definir conforme escopo aprovado, a contar da data de contratação.",
    paymentTerms: "50% na contratação e 50% na entrega do projeto aprovado.",
    taxes: "ISS — 5% incluso.",
  },

  LOCACAO: {
    title: "LOCAÇÃO DE EQUIPAMENTOS",
    intro:
      "Segue nossa proposta para locação dos equipamentos relacionados abaixo, conforme solicitado por V.Sa.",
    scope: `LOCAÇÃO

Disponibilização dos equipamentos relacionados na tabela de itens desta proposta, em regime de locação, pelo período contratado.

Condições da locação:
• Os equipamentos são entregues em perfeitas condições de uso
• A manutenção preventiva dos equipamentos é de responsabilidade da DRR Projetos
• Danos decorrentes de mau uso serão avaliados e cobrados à parte
• A devolução deverá ocorrer nas mesmas condições de recebimento, ressalvado o desgaste natural`,
    included: `Entrega e retirada dos equipamentos no local indicado
Manutenção preventiva durante o período de locação`,
    notes: `O cliente é responsável pela guarda e conservação dos equipamentos durante o período de locação.
A prorrogação do período deverá ser solicitada com antecedência mínima de 5 dias do término.
Atrasos na devolução serão cobrados proporcionalmente ao valor mensal da locação.`,
    amountLabel: "VALOR MENSAL DA LOCAÇÃO",
    deadline: "Conforme período contratado.",
    paymentTerms: "Mensal, com vencimento a 30 dias da data de emissão da nota fiscal.",
    taxes: "ISS — 5% incluso.",
  },
};

export function proposalTemplate(type: string): ProposalTemplate {
  return TEMPLATES[(type as ProposalTypeId)] ?? TEMPLATES.INSPECAO;
}

// "26181" + revisão 2 => "26.181-R2" (formato usado nas propostas).
export function proposalNumber(
  leadNumber: string | null,
  revision: number,
  type: string,
): string {
  const prefix = PROPOSAL_TYPE_PREFIX[type] ?? "";
  const base = leadNumber
    ? leadNumber.length >= 5
      ? `${leadNumber.slice(0, 2)}.${leadNumber.slice(2)}`
      : leadNumber
    : "—";
  return `${prefix}${base}-R${revision}`;
}

// ---- Valor por extenso (padrão das propostas: "(Cento e noventa e quatro mil…)") ----

const EXT_UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const EXT_DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const EXT_DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const EXT_CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ext999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  const parts: string[] = [];
  if (c) parts.push(EXT_CENTENAS[c]);
  if (resto >= 10 && resto <= 19) parts.push(EXT_DEZ_A_DEZENOVE[resto - 10]);
  else {
    if (d) parts.push(EXT_DEZENAS[d]);
    if (u) parts.push(EXT_UNIDADES[u]);
  }
  return parts.join(" e ");
}

function extInt(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const centenas = n % 1000;
  const parts: string[] = [];
  if (milhoes) parts.push(milhoes === 1 ? "um milhão" : `${ext999(milhoes)} milhões`);
  if (milhares) parts.push(milhares === 1 ? "mil" : `${ext999(milhares)} mil`);
  if (centenas) parts.push(ext999(centenas));
  // "e" antes do último grupo quando ele é < 100 ou centena redonda.
  if (parts.length > 1 && (centenas > 0 && (centenas < 100 || centenas % 100 === 0))) {
    const last = parts.pop()!;
    return `${parts.join(", ")} e ${last}`;
  }
  return parts.join(", ");
}

// "R$ 194.629,00" → "Cento e noventa e quatro mil, seiscentos e vinte e nove reais"
export function currencyInWords(value: number): string {
  const cents = Math.round(value * 100);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const parts: string[] = [];
  if (reais > 0) {
    // Milhões exatos pedem "de": "um milhão de reais".
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? "de " : "";
    parts.push(`${extInt(reais)} ${de}${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) parts.push(`${extInt(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (parts.length === 0) return "zero reais";
  const s = parts.join(" e ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}


// Data por extenso: "São Paulo, 25 de março de 2026."
export function longDate(d: Date = new Date()): string {
  return `${COMPANY.city.split(" - ")[0]}, ${new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)}.`;
}
