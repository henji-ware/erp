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
  DESMONTAGEM: "Desmontagem",
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
Ferramental e equipamentos da equipe de montagem
Despesas — transporte e alimentação da equipe
Todos os EPI's para execução do serviço`,
    notes: `O cliente deverá disponibilizar a área livre, desimpedida e nivelada para a execução da montagem.
A descarga e a movimentação dos materiais dentro da obra são por conta do cliente.
O horário de trabalho compreende o normal regido pela CLT e acordo coletivo da categoria. Serviços em finais de semana, feriados e/ou fora do horário terão cobrança adicional de horas extras, mediante anuência expressa e por escrito.
Caso haja perda de um dia de trabalho por razões não imputáveis à DRR Projetos, será cobrado R$ 750,00 por pessoa/dia ou R$ 150,00 por hora em paralisações parciais.`,
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
    title: "DESMONTAGEM DE ESTRUTURAS",
    intro:
      "Segue nossa proposta para desmontagem das estruturas porta paletes existentes, conforme solicitado por V.Sa.",
    scope: `SERVIÇOS DE DESMONTAGEM

Fornecimento de mão de obra especializada para desmontagem das estruturas existentes, com preservação dos componentes reaproveitáveis.

Escopo dos serviços:
• Desmontagem criteriosa dos conjuntos, preservando os componentes
• Separação e triagem entre componentes íntegros e danificados
• Organização e paletização dos componentes para armazenagem ou transporte
• Limpeza da área e retirada de resíduos da desmontagem

${NORMAS}`,
    included: `Ferramental e equipamentos da equipe
Despesas — transporte e alimentação da equipe
Todos os EPI's para execução do serviço`,
    notes: `A retirada dos paletes e cargas armazenadas nas estruturas é de responsabilidade do cliente antes do início dos serviços.
O transporte dos componentes desmontados para fora da unidade não está incluso, salvo indicação em contrário nesta proposta.
Serviços em finais de semana, feriados e/ou fora do horário normal terão cobrança adicional de horas extras, mediante anuência expressa e por escrito.`,
    amountLabel: "VALOR TOTAL DA DESMONTAGEM",
    deadline: "A definir conforme cronograma aprovado, a contar do início dos serviços.",
    paymentTerms: "20% de sinal, saldo 30/60/90 dias da data da confirmação do pedido.",
    taxes: "ISS — 5% incluso sobre a mão de obra.",
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

// Data por extenso: "São Paulo, 25 de março de 2026."
export function longDate(d: Date = new Date()): string {
  return `${COMPANY.city.split(" - ")[0]}, ${new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)}.`;
}
