# DRR Projetos e Equipamentos — Sistema de Gestão (ERP + CRM)

Sistema de gestão da **DRR Projetos e Equipamentos**, empresa de estruturas de
armazenagem logística: porta-paletes, gradil NR12, wire deck e acessórios de
proteção.

Reúne num só lugar CRM, vendas, locação, projetos, inspeções, manutenção,
estoque, financeiro, RH e relatórios, com controle de acesso por usuário, avisos
por e-mail e um assistente de IA ligado aos dados do sistema.

Construído com Next.js 15 (App Router e Server Actions), TypeScript, Prisma com
PostgreSQL no Neon, Tailwind CSS e Resend para e-mail. Publicado na Vercel.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [DeskHelper AI](#deskhelper-ai)
3. [Controle de acesso](#controle-de-acesso)
4. [Módulos](#módulos)
5. [Integração entre os módulos](#integração-entre-os-módulos)
6. [E-mails](#e-mails)
7. [Como rodar localmente](#como-rodar-localmente)
8. [Deploy](#deploy)
9. [Estrutura do código](#estrutura-do-código)
10. [Convenções de interface](#convenções-de-interface)
11. [Stack](#stack)

---

## Visão geral

### Comercial

Clientes com linha do tempo 360°, leads em Kanban com numeração sequencial no
formato `AAMMNN`, motivo de perda e conversão de lead em cliente. Propostas em
papel timbrado, prontas para impressão. Pedidos que baixam o estoque e geram o
financeiro automaticamente.

### Operação técnica

Projetos e obras com faturamento por etapas. Inspeções e laudos com classificação
de risco em verde, amarelo e vermelho, engenheiro responsável e número da ART.
Contratos de manutenção recorrente com próxima visita e reagendamento. Locação de
equipamentos com devolução e faturamento mensal.

### Administrativo e apoio

Contas a pagar e a receber com pagamentos parciais e formas de pagamento.
Catálogo de equipamentos e serviços com controle de estoque. Fornecedores ligados
às contas a pagar. RH com categorias, metas e comissão. Agendamentos de visitas e
reuniões.

### Gestão e análise

Dashboard com indicadores unificados e painel de pendências. Relatórios com curva
ABC, comissões e análise de perdas, exportáveis em CSV e PDF. Auditoria de quem
criou, alterou ou excluiu cada registro. Lixeira com expurgo automático em 30
dias.

### Produtividade

Busca rápida por **Ctrl + K**, que leva a qualquer módulo ou envia a pergunta ao
assistente. Anexos em PDF e Word armazenados no Vercel Blob. Busca e paginação em
todas as listagens. Quatorze temas, com modo claro, escuro ou seguindo o sistema.

---

## DeskHelper AI

Assistente aberto pela barra lateral ou pelo atalho **Ctrl + K**. Recebe um resumo
dos dados do ERP — pipeline em aberto, contas vencidas, inspeções da semana e
itens com estoque baixo — e responde em português. O texto aparece em tempo real,
conforme é gerado, e pode ser interrompido a qualquer momento.

Em cada proposta, na rota `/proposals/[id]`, há um assistente dedicado que redige
o escopo técnico, os termos comerciais, a análise de riscos de uma vistoria ou
revisa o texto já existente.

### Como funciona uma pergunta

O navegador envia apenas a pergunta — a chave de API fica no servidor. A rota
exige sessão válida e responde `401` em JSON se não houver. Em seguida busca a
chave da conta, lê do banco o resumo do ERP (apenas leitura) e valida a URL base,
bloqueando endereços de rede interna. Só então chama o provedor de IA, e devolve a
resposta ao navegador em partes, conforme ela é gerada.

### Provedores disponíveis

São onze, todos opcionais e configuráveis por usuário:

- **Anthropic Claude** — bom para texto técnico e análise
- **Google Gemini** — aguenta documentos longos e tem faixa de uso gratuita
- **OpenAI** — uso geral
- **DeepSeek** — melhor custo por raciocínio
- **Groq** — o mais rápido para responder
- **Mistral** — europeu, forte em vários idiomas
- **xAI (Grok)** — respostas diretas e analíticas
- **Cohere** — focado em documentos e dados da empresa
- **OpenRouter** — vários fornecedores com uma única chave
- **Ollama** — roda offline, na própria máquina, sem custo por uso
- **Servidor próprio** — qualquer servidor que fale o formato de API da OpenAI,
  como LM Studio, vLLM, Together ou Azure

### A lista de modelos vem da conta, não do código

O sistema não oferece uma lista fixa de modelos. Provedores lançam e aposentam
modelos o tempo todo, e uma lista escrita no código envelhece: o
`gemini-2.0-flash`, por exemplo, saiu do ar e passou a devolver erro 404.

Ao informar a chave, o aplicativo consulta a API do próprio provedor e mostra
exatamente os modelos que aquela chave aceita naquele momento. Se um modelo que
estava salvo não aparecer mais nessa lista, ele é descartado automaticamente.

### Onde a chave de API fica guardada

A chave é gravada **cifrada no banco** (AES-256-GCM), ligada à conta do usuário.
O servidor a decifra apenas no instante de chamar o provedor; ela nunca volta ao
navegador. A tela mostra só os quatro últimos caracteres, o suficiente para a
pessoa reconhecer qual chave está salva.

O cookie guarda somente o provedor escolhido, o modelo e a URL base — nunca a
chave. Cookie viaja em toda requisição e é legível por qualquer script da página,
então não é lugar para segredo.

A cifra usa a variável `AI_ENCRYPTION_KEY`; sem ela, o `SESSION_SECRET` serve de
origem. **Trocar esse segredo torna as chaves guardadas ilegíveis** — o sistema
continua de pé (cai na chave do `.env`, se houver, e a tela avisa), mas cada
usuário precisa cadastrar a dele de novo. Não há recuperação.

Como a chave vive na conta e não na máquina, ela acompanha o usuário em qualquer
computador ou celular. Para uma chave única da equipe, use a variável de ambiente
do servidor: ela vale para quem não cadastrar a própria.

Antes desta versão a chave ficava no `localStorage` do navegador. Quem já tinha
uma cadastrada não precisa refazer nada: na primeira carga ela é enviada ao
servidor e apagada do navegador.

### Chaves no servidor

Definindo a variável correspondente, a chave passa a valer para todos e ninguém
precisa configurar nada na interface:

```
ANTHROPIC_API_KEY      Anthropic Claude
GEMINI_API_KEY         Google Gemini (aceita também GOOGLE_API_KEY)
OPENAI_API_KEY         OpenAI
DEEPSEEK_API_KEY       DeepSeek
GROQ_API_KEY           Groq
MISTRAL_API_KEY        Mistral
XAI_API_KEY            xAI
COHERE_API_KEY         Cohere
OPENROUTER_API_KEY     OpenRouter
OLLAMA_BASE_URL        Ollama
```

### O que acontece quando falha

Falhas passageiras — sobrecarga do provedor, respostas `429` ou `503` — são
repetidas automaticamente até quatro vezes, com espera crescente, e a tela avisa
que está tentando de novo.

No modo de streaming a repetição só acontece antes do primeiro token chegar.
Depois que o texto começou a sair, repetir duplicaria a resposta na tela, então o
erro é mostrado.

Chave inválida e modelo inexistente não são repetidos, porque repetir não
resolveria — nesses casos a mensagem explica o que fazer.

### Segurança das rotas

As rotas `/api/ai/chat`, `/api/ai/models`, `/api/ai/proposal` e `/api/ai/test`
exigem sessão e respondem `401` em JSON.

A URL base enviada pelo navegador é validada antes de qualquer chamada, e
endereços de rede interna são bloqueados como proteção contra SSRF. A exceção são
os provedores locais, Ollama e Servidor próprio, onde apontar para a própria
máquina é justamente o esperado.

---

## Controle de acesso

O **administrador** vê e gerencia tudo, de todos os usuários, e administra os
logins.

O **usuário comum** vê e edita apenas o que ele mesmo criou no CRM e em vendas,
além dos registros que alguém marcou como compartilhados.

Cada registro de CRM e vendas tem um dono, e o usuário comum só enxerga os seus. O
botão de compartilhar libera aquele item para todos. Produtos, equipamentos e
fornecedores são catálogo compartilhado da empresa, visível para todos.

Cada registro mostra "adicionado por" com o nome de quem o criou, para o
administrador localizar rapidamente. A criação de usuário pode exigir verificação
de e-mail antes do primeiro login.

Em Configurações, na aba Sistema, os números do sistema inteiro, a infraestrutura
em uso e as instruções de terminal aparecem somente para administradores. Os
demais veem apenas os dados da própria conta.

---

## Módulos

- **Dashboard** — `/` — indicadores unificados e painel de pendências
- **Clientes (CRM)** — `/customers` — cadastro e linha do tempo 360° de cada cliente
- **Leads e orçamentos** — `/leads` — Kanban com numeração sequencial e conversão em cliente
- **Propostas** — `/proposals/[id]` — papel timbrado para impressão e assistente de IA
- **Projetos e obras** — `/projects` — engenharia e montagem, com faturamento por etapas
- **Inspeções e laudos** — `/inspections` — vistorias com risco, engenheiro e número da ART
- **Manutenção** — `/maintenance` — contratos recorrentes e reagendamento
- **Equipamentos e serviços** — `/products` — catálogo com estoque e itens locáveis
- **Vendas e pedidos** — `/orders` — baixa o estoque e gera conta a receber
- **Locações** — `/rentals` — aluguel, devolução e faturamento mensal
- **Agendamentos** — `/appointments` — visitas e reuniões ligadas a clientes e equipe
- **Fornecedores** — `/suppliers` — cadastro ligado às contas a pagar
- **RH e equipe** — `/hr` — funcionários, categorias, metas e comissão
- **Financeiro** — `/finance` — contas a pagar e receber, com pagamentos parciais
- **Relatórios** — `/reports` — somente administrador — curva ABC, comissões, perdas e exportação
- **Usuários** — `/users` — somente administrador — logins, papéis e desempenho
- **Auditoria** — `/audit` — somente administrador — histórico de alterações
- **Lixeira** — `/trash` — itens arquivados, com expurgo automático em 30 dias
- **Configurações** — `/settings` — abas de IA, aparência, preferências e sistema

---

## Integração entre os módulos

Um lead vira cliente, e o cliente é a origem dos pedidos. Confirmar um pedido
baixa o estoque, e cancelá-lo devolve as quantidades.

Vendas e projetos geram contas a receber automaticamente. Locações e contratos de
manutenção também alimentam o financeiro.

O dashboard e os relatórios são consolidados a partir dos dados de todos os
módulos, sem cadastro paralelo.

---

## E-mails

**Verificação de conta.** Ao criar um usuário, ele recebe um link para confirmar o
e-mail antes de acessar o sistema.

**Reset de senha.** O fluxo de "esqueci a senha" envia um código de seis dígitos
para o e-mail cadastrado. A resposta da tela não revela se a conta existe, e as
tentativas são limitadas para reduzir abuso.

**Avisos de prazo.** Um cron diário, na rota `/api/cron/alerts`, envia um resumo
de contas a vencer, inspeções agendadas, visitas de manutenção e devoluções de
locação próximas. Cada pessoa recebe os itens dos quais é dona; administradores
recebem tudo.

Sem a variável `RESEND_API_KEY` configurada o sistema funciona normalmente,
apenas não envia e-mails, e a verificação de conta é pulada.

---

## Como rodar localmente

O pré-requisito é um banco PostgreSQL. Uma branch do Neon serve bem para
desenvolvimento.

```bash
npm install                 # dependências

# .env — defina pelo menos:
#   DATABASE_URL="postgresql://...?sslmode=require"        (conexão pooled)
#   DATABASE_URL_UNPOOLED="postgresql://..."               (conexão direta)
#   SESSION_SECRET="uma-string-longa-e-aleatoria"

npm run db:push             # cria as tabelas a partir do schema
npm run db:seed             # popula dados de exemplo e usuários administradores
npm run dev                 # http://localhost:3000
```

Para recriar o banco do zero, use `npm run db:reset`, que apaga todos os dados.

O seed cria Vendedor Demo e Representante Demo como administradores. A senha inicial está definida
em `prisma/seed.mjs` e deve ser trocada em uso real, pela tela de Usuários ou pelo
fluxo de reset.

**Atenção ao DATABASE_URL.** Ele precisa começar com `postgresql://`. Um valor de
SQLite, como `file:./dev.db`, faz o Prisma recusar a conexão e nenhuma página
carrega — nem a de login — porque o layout consulta o usuário logado a cada
requisição.

---

## Deploy

O deploy é na Vercel, com banco no Neon e e-mail no Resend.

1. Crie um PostgreSQL no Neon e rode `npx prisma db push` apontando para ele.
2. Configure as variáveis de ambiente na Vercel. O modelo está em
   [`.env.production.example`](.env.production.example).
3. Os crons de avisos e limpeza da lixeira já estão declarados em [`vercel.json`](vercel.json), uma vez ao dia.
4. Faça `git push`. A Vercel builda e publica.

As variáveis necessárias:

```
DATABASE_URL             conexão Neon pooled
DATABASE_URL_UNPOOLED    conexão Neon direta
SESSION_SECRET           segredo do cookie de sessão
BLOB_READ_WRITE_TOKEN    Vercel Blob, para os anexos
RESEND_API_KEY           envio de e-mail (opcional)
EMAIL_FROM               remetente dos e-mails (opcional)
APP_URL                  endereço público, usado nos links dos e-mails
CRON_SECRET              protege as rotas de cron
```

As chaves de IA são opcionais e estão listadas na seção do DeskHelper AI.

---

## Estrutura do código

A pasta `app` contém as rotas e as telas, no App Router do Next.js. Dentro dela,
`api/ai` reúne as quatro rotas do assistente — chat, models, proposal e test;
`components` guarda a barra lateral, o DeskHelper, a busca por Ctrl + K e os
ícones; `settings` tem as abas de configuração; e as demais pastas são os módulos
de negócio.

A pasta `lib` concentra a lógica que não é de tela:

- `lib/ai/client.ts` — motor único de execução, com streaming, timeout e novas
  tentativas, cobrindo os onze provedores
- `lib/ai/providers.ts` — catálogo dos provedores
- `lib/ai/context.ts` — monta o resumo do ERP que vira contexto do modelo
- `lib/ai/settings.ts` — chave efetiva, URL base e defesa contra SSRF
- `lib/ai/guard.ts` — exige sessão nas rotas de IA
- `lib/auth.ts` — sessão, papéis e escopo por dono do registro
- `lib/money.ts` — normalização e divisão exata de valores em centavos
- `lib/rate-limit.ts` — limites por IP/conta para login, reset e IA

Os testes unitários dos cálculos e das regras críticas rodam com `npm test`.

O modelo de dados fica em `prisma/schema.prisma`, e os temas, o modo claro e
escuro e os utilitários visuais em `app/globals.css`.

---

## Convenções de interface

Duas regras evitam bugs difíceis de enxergar. As duas já causaram estilo que
simplesmente não era aplicado, sem nada quebrar e sem aviso nenhum.

### 1. Não use o prefixo `dark:`

O claro e escuro deste projeto não é a classe `.dark` do Tailwind. É o atributo
`data-mode` no elemento `html`, que troca as variáveis CSS por trás de `slate` e
`white`.

Ou seja, `bg-white` e `text-slate-900` já viram a versão escura sozinhos. Um
`dark:text-white` por cima renderiza texto quase preto no modo escuro, porque
`white` aponta para a superfície do tema, que no escuro é escura.

### 2. Não use opacidade nas cores `brand`

Escrever `bg-brand-600/10` não gera classe nenhuma. As cores `brand` são
variáveis CSS opacas, e o modificador de opacidade do Tailwind exige o formato
`rgb(... / <alpha-value>)`.

Para destaque suave existem utilitários definidos em `app/globals.css` com
`color-mix`, que funcionam e acompanham o tema escolhido: `accent-soft` para
fundo suave, `accent-border` para borda, `accent-selected` para cartão ou opção
marcada e `accent-icon` para ícone.

---

## Stack

- **Next.js 15** e **React 18** — App Router, Server Actions e Middleware
- **TypeScript**
- **Prisma 6** com **PostgreSQL** no Neon
- **Tailwind CSS 3** — quatorze temas, com modo claro, escuro ou do sistema
- **Resend** — envio de e-mails
- **Vercel** — hospedagem, Blob para anexos e Cron para os avisos
- **Autenticação própria**, sem dependências externas, com scrypt e HMAC via Web
  Crypto
- **IA por HTTP direto** aos provedores, sem SDKs: um único motor cobre os onze
