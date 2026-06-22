# DRR Projetos e Equipamentos — Sistema de Gestão

Sistema de gestão da **DRR Projetos e Equipamentos** (estruturas de armazenagem
logística: porta-paletes, gradil NR12, wire deck, acessórios de proteção).
Unifica **Projetos/Obras, Inspeções/Laudos, CRM, Vendas, Locação, Equipamentos,
Agendamentos, RH, Financeiro e Relatórios**.
Construído com Next.js 15 (App Router), TypeScript, Prisma + SQLite e Tailwind CSS.

## A integração entre os módulos

O grande diferencial é que os módulos conversam entre si:

- **CRM → Vendas:** um lead pode ser convertido em cliente; o cliente vira a origem dos pedidos.
- **Vendas → Estoque:** ao **confirmar** um pedido, o estoque dos produtos é **baixado automaticamente** (e devolvido se o pedido for cancelado).
- **Vendas → Financeiro:** ao confirmar um pedido, uma **conta a receber** é gerada automaticamente.
- **Tudo → Relatórios:** os relatórios são gerados automaticamente a partir dos dados de todos os módulos.

## Módulos

| Módulo | Rota | O que faz |
|--------|------|-----------|
| Login | `/login` | Autenticação com sessão por cookie assinado |
| Dashboard | `/` | KPIs unificados, atividades e próximos agendamentos |
| Clientes (CRM) | `/customers` | Cadastro, **edição** e exclusão de clientes |
| Leads / Orçamentos | `/leads` | Kanban de oportunidades, edição e conversão em cliente |
| **Projetos / Obras** | `/projects` | Engenharia, montagem, remanejamento, manutenção, venda e locação — com status, responsável e valor em carteira |
| **Inspeções / Laudos** | `/inspections` | Vistorias técnicas com classificação de risco (verde/amarelo/vermelho), engenheiro e nº da ART |
| Equipamentos / Serviços | `/products` | Catálogo de equipamentos (com estoque/locação) e **serviços** |
| Vendas / Pedidos | `/orders` | Pedidos com itens e **vendedor**; baixa estoque e gera financeiro |
| Agendamentos | `/appointments` | **Visitas e reuniões** ligadas a clientes e equipe |
| Fornecedores | `/suppliers` | Cadastro de fornecedores (contas a pagar) |
| RH / Equipe | `/hr` | Funcionários e vendedores |
| Financeiro | `/finance` | Contas a pagar/receber, **pagamentos parciais** e formas de pagamento |
| Relatórios | `/reports` | Relatórios automáticos + exportação CSV/PDF |
| Configurações | `/settings` | **Temas**, animações e informações do sistema |

## Relatórios automáticos

A página `/reports` calcula e exibe automaticamente:

- **KPIs**: faturamento, nº de pedidos, ticket médio e margem estimada.
- **Vendas por mês** (gráfico de barras).
- **Funil de leads** por etapa (valor e quantidade).
- **Curva ABC** de produtos (classificação A/B/C por faturamento).
- **Top clientes** por faturamento.
- **Demonstrativo financeiro** (caixa realizado + saldo projetado).
- **Filtro por período** e **exportação**: CSV (abre no Excel) e PDF (via "Imprimir").

## Acesso (login)

Usuários criados pelo seed:

```
admin@example.test   — senha: [REMOVIDO_DO_HISTORICO]
operador@example.test    — senha: [REMOVIDO_DO_HISTORICO]
```

A senha é armazenada com hash **scrypt**; a sessão usa cookie HttpOnly assinado com HMAC.
Todas as rotas são protegidas por `middleware.ts` (redireciona para `/login` se não autenticado).

## Como rodar

```bash
npm install          # instala dependências
npm run db:push      # cria o banco SQLite a partir do schema
npm run db:seed      # popula dados de exemplo + usuários (Vendedor Demo e Representante Demo)
npm run dev          # inicia em http://localhost:3000
```

Para recriar o banco do zero com dados de exemplo: `npm run db:reset`.

> Importante: defina `SESSION_SECRET` no `.env` (já incluído um valor de desenvolvimento).

## Stack

- **Next.js 15** + **React 18** (App Router, Server Actions, Middleware)
- **Prisma 6** ORM + **SQLite** (arquivo `prisma/dev.db`)
- **Tailwind CSS 3**
- **TypeScript**
- Autenticação e relatórios **sem dependências externas** (Node `crypto` + Web Crypto)

## Indo para produção (PostgreSQL)

1. Em `prisma/schema.prisma`, troque `provider = "sqlite"` por `provider = "postgresql"`.
2. Configure `DATABASE_URL` e um `SESSION_SECRET` forte (veja `.env.production.example`).
3. Rode `npx prisma migrate deploy` (ou `prisma db push`) e `npm run build && npm start`.

Nenhuma outra parte do código precisa mudar — o Prisma abstrai o banco.
