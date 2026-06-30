# DRR Projetos e Equipamentos — Sistema de Gestão (ERP + CRM)

Sistema de gestão completo da **DRR Projetos e Equipamentos** — empresa de
estruturas de armazenagem logística (porta-paletes, gradil NR12, wire deck,
acessórios de proteção). Unifica num só lugar **CRM, vendas, locação, projetos,
inspeções, manutenção, estoque, financeiro, RH e relatórios**, com **controle de
acesso por usuário** e **notificações por e-mail**.

Feito com **Next.js 15** (App Router + Server Actions), **TypeScript**,
**Prisma + PostgreSQL (Neon)**, **Tailwind CSS** e **Resend** (e-mail).
Deploy na **Vercel**.

---

## ✨ Principais recursos

- **CRM & funil de vendas** — clientes, leads/orçamentos em Kanban com numeração
  sequencial (`AAMMNN`), motivo de perda e conversão de lead em cliente.
- **Vendas, estoque e locação** — pedidos que baixam estoque e geram financeiro;
  catálogo de equipamentos/serviços; contratos de **locação** com devolução e
  faturamento mensal.
- **Operação técnica** — projetos/obras, **inspeções/laudos** (risco verde/amarelo/
  vermelho, ART) e **contratos de manutenção** recorrente.
- **Financeiro** — contas a pagar/receber, pagamentos parciais, formas de pagamento
  e faturamento de projetos por etapas.
- **Anexos** — propostas, ARTs, laudos e contratos (PDF/Word) em leads, projetos e
  inspeções (armazenados no Vercel Blob).
- **Controle de acesso** — papéis Admin/Usuário, isolamento por dono e
  compartilhamento por registro (detalhes abaixo).
- **E-mails** — verificação de conta, reset de senha por código e avisos de prazo.
- **Produtividade** — busca e paginação nas listagens, **lixeira** (soft delete com
  expurgo em 30 dias), **auditoria** de ações e **14 temas** (claro/escuro/sistema).

---

## 🔐 Controle de acesso

| Papel | O que enxerga |
|-------|----------------|
| **Administrador** | Vê e gerencia **tudo**, de todos os usuários, e gerencia os logins. |
| **Usuário** | Vê e edita **apenas o que ele mesmo criou** (CRM/vendas). |

- Cada registro de CRM/vendas tem um **dono**; o usuário comum só enxerga os seus.
- O botão **"compartilhar"** em cada registro libera aquele item para todos os usuários.
- **Produtos/equipamentos e fornecedores** são catálogo compartilhado da empresa.
- Cada registro mostra **"adicionado por &lt;nome&gt;"** para o admin localizar rápido.
- A criação de usuário pode exigir **verificação de e-mail** antes do primeiro login.

---

## 📧 E-mails (Resend)

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

## 🧩 Módulos

| Módulo | Rota | O que faz |
|--------|------|-----------|
| Dashboard | `/` | KPIs unificados + painel de pendências (vencidos, inspeções, estoque…) |
| Clientes (CRM) | `/customers` | Cadastro + **linha do tempo 360°** de cada cliente |
| Leads / Orçamentos | `/leads` | Kanban com nº sequencial, motivo de perda e conversão em cliente |
| Projetos / Obras | `/projects` | Engenharia, montagem, remanejamento — com faturamento por etapas |
| Inspeções / Laudos | `/inspections` | Vistorias com risco (verde/amarelo/vermelho), engenheiro e nº da ART |
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
| Configurações | `/settings` | Temas, modo claro/escuro e informações do sistema |

---

## 🔗 Integração entre os módulos

- **CRM → Vendas:** um lead vira cliente; o cliente é a origem dos pedidos.
- **Vendas → Estoque:** confirmar um pedido **baixa o estoque** (e devolve se cancelado).
- **Vendas/Projetos → Financeiro:** geram **contas a receber** automaticamente.
- **Tudo → Relatórios e Dashboard:** consolidados a partir dos dados de todos os módulos.

---

## ▶️ Como rodar (local)

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

---

## 🚀 Deploy (Vercel + Neon + Resend)

1. **Banco:** crie um PostgreSQL no **Neon** e rode `npx prisma db push` apontando
   para ele.
2. **Variáveis de ambiente** na Vercel (modelo em [`.env.production.example`](.env.production.example)):
   - `DATABASE_URL`, `DATABASE_URL_UNPOOLED` — conexão Neon (pooled e direta).
   - `SESSION_SECRET` — segredo forte para o cookie de sessão.
   - `BLOB_READ_WRITE_TOKEN` — Vercel Blob (anexos).
   - `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` — e-mail (opcional).
   - `CRON_SECRET` — protege o cron de avisos.
3. **Cron de avisos:** já configurado em [`vercel.json`](vercel.json) (1x/dia).
4. `git push` → a Vercel builda e publica.

---

## 🧱 Stack

- **Next.js 15** + **React 18** — App Router, Server Actions, Middleware
- **TypeScript**
- **Prisma 6** + **PostgreSQL (Neon)**
- **Tailwind CSS 3** — 14 temas com modo claro/escuro/sistema
- **Resend** — envio de e-mails
- **Vercel** — hospedagem, Blob (anexos) e Cron (avisos)
- Autenticação **sem dependências externas** (scrypt + HMAC via Node/Web Crypto)
