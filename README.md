# DRR Projetos e Equipamentos — Sistema de Gestão (ERP + CRM)

Sistema de gestão completo da **DRR Projetos e Equipamentos** — empresa de
estruturas de armazenagem logística (porta-paletes, gradil NR12, wire deck,
acessórios de proteção). Unifica num só lugar **CRM, vendas, locação, projetos,
inspeções, manutenção, estoque, financeiro, RH e relatórios**, com **controle de
acesso por usuário**, **notificações por e-mail** e um **assistente de IA
conectado aos dados do sistema**.

Feito com **Next.js 15** (App Router + Server Actions), **TypeScript**,
**Prisma + PostgreSQL (Neon)**, **Tailwind CSS** e **Resend** (e-mail).
Deploy na **Vercel**.

---

## Principais recursos

- **CRM & funil de vendas** — clientes, leads/orçamentos em Kanban com numeração
  sequencial (`AAMMNN`), motivo de perda e conversão de lead em cliente.
- **Vendas, estoque e locação** — pedidos que baixam estoque e geram financeiro;
  catálogo de equipamentos/serviços; contratos de **locação** com devolução e
  faturamento mensal.
- **Operação técnica** — projetos/obras, **inspeções/laudos** (risco verde/amarelo/
  vermelho, ART) e **contratos de manutenção** recorrente.
- **Financeiro** — contas a pagar/receber, pagamentos parciais, formas de pagamento
  e faturamento de projetos por etapas.
- **DeskHelper AI** — assistente que responde sobre os dados reais do ERP e ajuda a
  redigir escopos e mensagens comerciais (detalhes abaixo).
- **Busca rápida (Ctrl + K)** — vai direto a qualquer módulo ou manda a pergunta
  para o assistente.
- **Anexos** — propostas, ARTs, laudos e contratos (PDF/Word) em leads, projetos e
  inspeções (armazenados no Vercel Blob).
- **Controle de acesso** — papéis Admin/Usuário, isolamento por dono e
  compartilhamento por registro (detalhes abaixo).
- **E-mails** — verificação de conta, reset de senha por código e avisos de prazo.
- **Produtividade** — busca e paginação nas listagens, **lixeira** (soft delete com
  expurgo em 30 dias), **auditoria** de ações e **14 temas** (claro/escuro/sistema).

---

## DeskHelper AI

Assistente aberto pela barra lateral ou pelo **Ctrl + K**. Recebe um resumo dos
dados do ERP (pipeline, contas vencidas, inspeções da semana, estoque baixo) e
responde em português, com o texto saindo em tempo real e botão para interromper.

Há também um **assistente de propostas** em cada proposta (`/proposals/[id]`), que
redige escopo técnico, termos comerciais, análise de riscos de vistoria ou revisa
o texto existente.

### Provedores

Onze provedores são suportados: Anthropic Claude, Google Gemini, OpenAI, DeepSeek,
Groq, Mistral, xAI (Grok), Cohere, OpenRouter, **Ollama** (roda offline, na própria
máquina) e **Servidor próprio** (qualquer servidor que fale o formato de API da
OpenAI — LM Studio, vLLM, Together, Azure).

### A lista de modelos vem da conta do usuário

O sistema **não oferece uma lista fixa de modelos**. Provedores lançam e aposentam
modelos o tempo todo, e uma lista escrita no código envelhece: o `gemini-2.0-flash`,
por exemplo, saiu do ar e passou a devolver 404.

Ao configurar a chave, o app consulta a API do próprio provedor e mostra
**exatamente os modelos que aquela chave aceita hoje**. Um modelo salvo que não
aparecer mais nessa lista é descartado automaticamente.

### Onde a chave fica guardada

| Onde | O quê |
|------|-------|
| `localStorage` do navegador, separado por conta | A chave de API |
| Cookie, separado por conta | Provedor, modelo e URL base — **nunca a chave** |
| Banco de dados | Nada |

Decisões por trás disso:

- **A chave nunca vai para cookie.** Cookie viaja em toda requisição e é legível
  por qualquer script da página.
- **O armazenamento é separado por usuário.** Num computador compartilhado, quem
  entrar depois não herda (nem gasta) a chave de quem usou antes.
- **Consequência:** a chave não segue o usuário entre computadores. Para uma chave
  única da equipe, use a variável de ambiente do servidor (abaixo) e deixe o campo
  em branco.

### Chaves no servidor (opcional)

Definindo a variável correspondente, a chave vale para todos e ninguém precisa
configurar nada:

```
ANTHROPIC_API_KEY   GEMINI_API_KEY (ou GOOGLE_API_KEY)   OPENAI_API_KEY
DEEPSEEK_API_KEY    GROQ_API_KEY    MISTRAL_API_KEY      XAI_API_KEY
COHERE_API_KEY      OPENROUTER_API_KEY                   OLLAMA_BASE_URL
```

### Comportamento em falhas

- Erros passageiros ("modelo sobrecarregado", 429, 503) **são repetidos
  automaticamente** até 4 vezes, com espera crescente, e a tela avisa que está
  tentando de novo.
- No streaming a repetição só ocorre **antes do primeiro token** — depois disso,
  repetir duplicaria a resposta.
- Chave inválida e modelo inexistente **não** são repetidos: repetir não resolve.

### Rotas de IA

`/api/ai/chat`, `/api/ai/models`, `/api/ai/proposal` e `/api/ai/test` **exigem
sessão** e respondem `401` em JSON. A URL base enviada pelo navegador é validada
antes de qualquer chamada: endereços de rede interna são bloqueados (proteção
contra SSRF), exceto nos provedores locais, onde isso é o esperado.

---

## Controle de acesso

| Papel | O que enxerga |
|-------|----------------|
| **Administrador** | Vê e gerencia **tudo**, de todos os usuários, e gerencia os logins. |
| **Usuário** | Vê e edita **apenas o que ele mesmo criou** (CRM/vendas). |

- Cada registro de CRM/vendas tem um **dono**; o usuário comum só enxerga os seus.
- O botão **"compartilhar"** em cada registro libera aquele item para todos os usuários.
- **Produtos/equipamentos e fornecedores** são catálogo compartilhado da empresa.
- Cada registro mostra **"adicionado por &lt;nome&gt;"** para o admin localizar rápido.
- A criação de usuário pode exigir **verificação de e-mail** antes do primeiro login.
- Em **Configurações › Sistema**, números do sistema inteiro, infraestrutura e
  instruções de terminal aparecem **somente para administradores**; os demais veem
  apenas os dados da própria conta.

---

## E-mails (Resend)

- **Verificação de conta** — ao criar um usuário, ele recebe um link para confirmar
  o e-mail antes de acessar.
- **Reset de senha** — fluxo "esqueci a senha" com **código de 6 dígitos** enviado
  ao e-mail cadastrado.
- **Avisos de prazo** — um **cron diário** (`/api/cron/alerts`) envia um resumo de
  contas a vencer, inspeções agendadas, visitas de manutenção e devoluções de
  locação próximas — para o dono de cada item (admins recebem tudo).

> Sem `RESEND_API_KEY` configurada, o app funciona normalmente — apenas não envia
> e-mails (a verificação é pulada).

---

## Módulos

| Módulo | Rota | O que faz |
|--------|------|-----------|
| Dashboard | `/` | KPIs unificados + painel de pendências (vencidos, inspeções, estoque…) |
| Clientes (CRM) | `/customers` | Cadastro + **linha do tempo 360°** de cada cliente |
| Leads / Orçamentos | `/leads` | Kanban com nº sequencial, motivo de perda e conversão em cliente |
| Projetos / Obras | `/projects` | Engenharia, montagem, remanejamento — com faturamento por etapas |
| Inspeções / Laudos | `/inspections` | Vistorias com risco (verde/amarelo/vermelho), engenheiro e nº da ART |
| Propostas | `/proposals/[id]` | Papel timbrado para impressão + **assistente de IA** para o escopo |
| Manutenção | `/maintenance` | Contratos recorrentes com próxima visita e reagendamento |
| Equipamentos / Serviços | `/products` | Catálogo com estoque e itens locáveis |
| Vendas / Pedidos | `/orders` | Pedidos que baixam estoque e geram conta a receber |
| Locações | `/rentals` | Aluguel de equipamentos, devolução e faturamento mensal |
| Agendamentos | `/appointments` | Visitas e reuniões ligadas a clientes e equipe |
| Fornecedores | `/suppliers` | Cadastro ligado às contas a pagar |
| RH / Equipe | `/hr` | Funcionários, categorias (vendedor/representante/…), metas e comissão |
| Financeiro | `/finance` | Contas a pagar/receber, pagamentos parciais e formas de pagamento |
| Relatórios *(admin)* | `/reports` | KPIs, curva ABC, comissões, análise de perdas + export CSV/PDF |
| Usuários *(admin)* | `/users` | Gestão de logins, papéis e desempenho por perfil |
| Auditoria *(admin)* | `/audit` | Histórico de quem criou/alterou/excluiu cada registro |
| Lixeira | `/trash` | Itens arquivados (restaurar ou excluir; expurgo automático em 30 dias) |
| Configurações | `/settings` | Abas de **IA**, aparência, preferências e sistema |

---

## Integração entre os módulos

- **CRM → Vendas:** um lead vira cliente; o cliente é a origem dos pedidos.
- **Vendas → Estoque:** confirmar um pedido **baixa o estoque** (e devolve se cancelado).
- **Vendas/Projetos → Financeiro:** geram **contas a receber** automaticamente.
- **Tudo → Relatórios e Dashboard:** consolidados a partir dos dados de todos os módulos.

---

## Como rodar (local)

Pré-requisito: um banco **PostgreSQL** (uma branch do Neon serve bem para dev).

```bash
npm install                 # dependências

# .env — defina pelo menos:
#   DATABASE_URL="postgresql://...?sslmode=require"        (conexão pooled)
#   DATABASE_URL_UNPOOLED="postgresql://..."               (conexão direta)
#   SESSION_SECRET="uma-string-longa-e-aleatoria"

npm run db:push             # cria as tabelas a partir do schema
npm run db:seed             # popula dados de exemplo + usuários admin
npm run dev                 # http://localhost:3000
```

Para recriar o banco do zero: `npm run db:reset` *(apaga tudo)*.

O seed cria **Vendedor Demo** e **Representante Demo** como administradores. A senha inicial está
definida em `prisma/seed.mjs` — **troque-a** em uso real (pela tela de Usuários ou
pelo fluxo de reset).

> O `DATABASE_URL` precisa começar com `postgresql://`. Um valor de SQLite
> (`file:./dev.db`) faz o Prisma recusar a conexão e **nenhuma página carrega**,
> porque o layout consulta o usuário logado.

---

## Deploy (Vercel + Neon + Resend)

1. **Banco:** crie um PostgreSQL no **Neon** e rode `npx prisma db push` apontando
   para ele.
2. **Variáveis de ambiente** na Vercel (modelo em [`.env.production.example`](.env.production.example)):
   - `DATABASE_URL`, `DATABASE_URL_UNPOOLED` — conexão Neon (pooled e direta).
   - `SESSION_SECRET` — segredo forte para o cookie de sessão.
   - `BLOB_READ_WRITE_TOKEN` — Vercel Blob (anexos).
   - `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` — e-mail (opcional).
   - `CRON_SECRET` — protege o cron de avisos.
   - Chaves de IA (opcional) — veja a tabela na seção do DeskHelper AI.
3. **Cron de avisos:** já configurado em [`vercel.json`](vercel.json) (1x/dia).
4. `git push` → a Vercel builda e publica.

---

## Convenções de interface

Duas regras que evitam bugs difíceis de enxergar:

- **Não use o prefixo `dark:`.** O claro/escuro aqui não é a classe `.dark` do
  Tailwind: é o atributo `data-mode` no `<html>`, que troca as variáveis CSS de
  `slate` e `white`. Ou seja, `bg-white` e `text-slate-900` já viram a versão
  escura sozinhos — e um `dark:text-white` por cima renderiza texto quase preto no
  modo escuro, porque `white` aponta para a superfície do tema.
- **Não use opacidade nas cores `brand`** (`bg-brand-600/10`). Elas são variáveis
  CSS opacas, e o modificador de opacidade do Tailwind exige o formato
  `rgb(... / <alpha-value>)` — a classe simplesmente não é gerada. Para destaque
  suave, use os utilitários `accent-soft`, `accent-border`, `accent-selected` e
  `accent-icon`, definidos em `app/globals.css` com `color-mix`.

---

## Stack

- **Next.js 15** + **React 18** — App Router, Server Actions, Middleware
- **TypeScript**
- **Prisma 6** + **PostgreSQL (Neon)**
- **Tailwind CSS 3** — 14 temas com modo claro/escuro/sistema
- **Resend** — envio de e-mails
- **Vercel** — hospedagem, Blob (anexos) e Cron (avisos)
- Autenticação **sem dependências externas** (scrypt + HMAC via Node/Web Crypto)
- IA por **chamadas HTTP diretas** aos provedores, sem SDKs — um único motor
  (`lib/ai/client.ts`) cobre os onze, com streaming, timeout e novas tentativas
