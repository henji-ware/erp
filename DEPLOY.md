# Publicar o ERP DRR na nuvem (Vercel)

Stack: **Vercel** (hospedagem) + **Vercel Postgres** (banco) + **Vercel Blob** (anexos).
Você precisa de 2 contas grátis: **GitHub** e **Vercel**.

> Enquanto não publicar, a versão local continua funcionando normalmente (SQLite).

---

## 1) Criar contas

- GitHub: https://github.com/signup
- Vercel: https://vercel.com/signup → entre **com o GitHub** (botão "Continue with GitHub").

## 2) Criar o banco (Vercel Postgres)

No painel da Vercel: **Storage → Create Database → Postgres** → escolha a região (ex.: Washington / São Paulo) → Create.
Depois, na aba **".env.local"** do banco, copie a linha `DATABASE_URL=...`.

## 3) Criar o armazenamento de arquivos (Vercel Blob)

**Storage → Create Database → Blob** → Create. Copie o valor de `BLOB_READ_WRITE_TOKEN`.

## 4) Preparar o banco (uma vez)

Cole, no arquivo `erp-crm/.env`, as variáveis copiadas:

```
DATABASE_URL="postgres://...(da Vercel)..."
SESSION_SECRET="uma-string-longa-e-aleatoria"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_...(da Vercel)..."
```

Me avise que eu troco o banco para PostgreSQL e rodo a criação das tabelas + dados
(`npm run db:deploy`). (Ou você mesmo roda esse comando.)

## 5) Subir o código para o GitHub

```
cd erp-crm
git init
git add -A
git commit -m "ERP DRR"
```
Crie um repositório vazio no GitHub e siga as instruções "push an existing repository":
```
git remote add origin https://github.com/SEU_USUARIO/erp-drr.git
git branch -M main
git push -u origin main
```

## 6) Publicar na Vercel

Vercel → **Add New → Project** → importe o repositório `erp-drr`.
Em **Environment Variables**, adicione (Production + Preview + Development):

| Nome | Valor |
|------|-------|
| `DATABASE_URL` | a do Vercel Postgres |
| `SESSION_SECRET` | uma string longa aleatória |
| `BLOB_READ_WRITE_TOKEN` | o token do Vercel Blob |

Clique **Deploy**. Em ~1 min sai uma URL tipo `https://erp-drr.vercel.app`.

## 7) Pronto

Você e o Representante Demo acessam essa URL de **qualquer lugar**, fazem login
(admin@example.test / operador@example.test · senha `[REMOVIDO_DO_HISTORICO]`) e
compartilham os mesmos dados.

---

### Observações
- Os anexos passam a ser guardados no Vercel Blob (URL não-listada). O download
  continua passando pelo login do sistema.
- Para atualizar o sistema depois: `git push` → a Vercel publica sozinha.
- O banco local (SQLite) e o da nuvem (Postgres) são independentes.
