# Deploy seguro na Vercel

Este guia complementa o [README](README.md). Ele não contém credenciais,
endereços reais nem dados de produção.

## 1. Infraestrutura

Crie:

- um projeto na Vercel;
- um banco PostgreSQL, como Neon;
- um Vercel Blob privado para anexos;
- opcionalmente, uma conta Resend com domínio verificado.

Use projetos e credenciais separados para produção, preview e desenvolvimento.

## 2. Segredos

Configure as variáveis diretamente no painel da Vercel. Não cole valores em
arquivos versionados, issues, logs ou mensagens de commit.

Variáveis obrigatórias:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
SESSION_SECRET
AI_ENCRYPTION_KEY
CRON_SECRET
APP_URL
```

Para anexos, configure `BLOB_READ_WRITE_TOKEN`. Para e-mails, configure
`RESEND_API_KEY` e `EMAIL_FROM`. Chaves dos provedores de IA são opcionais.

Gere valores independentes para os três segredos. Um exemplo local de comando é:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Não reutilize segredos entre ambientes. Se algum valor tiver sido publicado,
revogue-o no provedor e gere outro; apenas apagar o texto do Git não basta.

## 3. Banco

Com as variáveis apontando para o ambiente correto:

```bash
npm ci
npm run db:deploy
```

O comando de deploy apenas sincroniza o schema. Ele não executa o seed.

> [!CAUTION]
> `npm run db:seed` e `npm run db:reset` apagam dados. Use-os somente em
> bancos descartáveis de desenvolvimento.

## 4. Publicação

Conecte o repositório à Vercel e mantenha a branch `main` como produção.
Antes do deploy, execute:

```bash
npm test
npm run build
npm run security:audit
```

Depois da publicação, valide:

- login, logout e recuperação de senha;
- separação entre administrador e usuário comum;
- upload e download de anexos privados;
- rotas de cron com e sem o cabeçalho de autorização;
- integração de e-mail;
- variáveis de preview separadas das de produção.

## 5. Operação

- Ative proteção da branch `main`, Dependabot, secret scanning e CodeQL.
- Revise alertas de segurança antes de cada release.
- Rotacione credenciais quando alguém perder acesso à equipe.
- Faça backup e teste a restauração do banco.
- Nunca use dados reais no seed, nos testes ou em screenshots públicas.

Vulnerabilidades devem ser relatadas de forma privada conforme
[`SECURITY.md`](SECURITY.md).
