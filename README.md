# DRR ERP + CRM

Sistema web de gestão para operações comerciais e técnicas de estruturas de
armazenagem. Reúne CRM, propostas, pedidos, projetos, inspeções, manutenção,
locação, estoque, financeiro, RH, relatórios e automações em uma única aplicação.

O projeto usa Next.js, TypeScript, Prisma e PostgreSQL. O deploy de referência é
feito na Vercel, com Neon, Vercel Blob e Resend.

> [!IMPORTANT]
> Este repositório contém somente código e dados fictícios de demonstração.
> Credenciais, bancos de produção, anexos e arquivos `.env` nunca devem ser
> commitados.

## Principais recursos

- CRM com clientes, histórico, leads em Kanban e propostas imprimíveis.
- Pedidos integrados ao estoque e ao financeiro.
- Projetos, inspeções, manutenções, locações e agendamentos.
- Contas a pagar e receber, pagamentos parciais e relatórios gerenciais.
- Controle de acesso por papel, proprietário e compartilhamento.
- Auditoria, lixeira com expurgo e anexos privados.
- DeskHelper AI com múltiplos provedores e ações sujeitas a confirmação.
- OAuth no OpenRouter e Google Gemini, além das chaves de API.
- Interface responsiva, busca global e temas claro/escuro.

## Arquitetura

- `app/` — páginas, Server Actions, rotas HTTP e componentes.
- `lib/` — autenticação, autorização, regras de negócio, IA e utilitários.
- `prisma/` — schema e seed de dados fictícios.
- `tests/` — testes unitários das regras críticas.

As páginas protegidas exigem sessão. O servidor também aplica autorização nas
ações e APIs: ocultar um botão na interface não é considerado uma barreira de
segurança.

## Requisitos

- Node.js 22.6 ou superior.
- PostgreSQL acessível para desenvolvimento.
- npm.

## Instalação local

1. Instale as dependências:

   ```bash
   npm ci
   ```

2. Copie `.env.production.example` para `.env` e substitua todos os valores de
   exemplo. Para desenvolvimento, são indispensáveis:

   ```dotenv
   DATABASE_URL="postgresql://..."
   DATABASE_URL_UNPOOLED="postgresql://..."
   SESSION_SECRET="gere-um-segredo-longo-e-aleatorio"
   AI_ENCRYPTION_KEY="gere-outro-segredo-longo-e-aleatorio"
   ```

3. Crie ou atualize as tabelas e inicie a aplicação:

   ```bash
   npm run db:push
   npm run dev
   ```

A aplicação ficará disponível em `http://localhost:3000`.

## Dados de demonstração

O seed é destrutivo: ele apaga os dados existentes antes de inserir exemplos
fictícios. Por isso, ele não faz parte do comando de deploy e exige duas
variáveis explícitas:

```text
SEED_CONFIRM_RESET=DELETE_ALL_DATA
SEED_ADMIN_PASSWORD=<senha local com pelo menos 12 caracteres>
```

Depois de configurar essas variáveis somente no terminal de desenvolvimento,
execute:

```bash
npm run db:seed
```

Nunca execute o seed contra produção. Os usuários demonstrativos são
`admin@example.test` e `operador@example.test`; a senha é apenas a que você
informar no ambiente e não é impressa no terminal.

## Variáveis de ambiente

O modelo completo e comentado está em
[`.env.production.example`](.env.production.example). Os grupos principais são:

- Banco: `DATABASE_URL` e `DATABASE_URL_UNPOOLED`.
- Sessão e criptografia: `SESSION_SECRET` e `AI_ENCRYPTION_KEY`.
- Arquivos: `BLOB_READ_WRITE_TOKEN`.
- E-mail: `RESEND_API_KEY` e `EMAIL_FROM`.
- Aplicação e cron: `APP_URL` e `CRON_SECRET`.
- IA: chaves opcionais específicas de cada provedor.

Gere segredos com um gerador criptográfico. Não reutilize o mesmo valor entre
sessão, criptografia e cron. Trocar `AI_ENCRYPTION_KEY` torna as chaves de IA já
armazenadas ilegíveis; planeje a rotação antes de fazê-la.

## Conectar contas de IA

Em **Configurações → Inteligência Artificial**, conecte o OpenRouter sem copiar
a chave, ou autorize o Gemini com Google após configurar o OAuth no servidor.
As chaves manuais continuam disponíveis.

OAuth não significa acesso gratuito ou uso da assinatura ChatGPT/Claude:
cotas e cobranças continuam sendo as do provedor e projeto autorizado.
A integração com assinatura ChatGPT via Codex ainda não está implementada.
Consulte [provedores compatíveis e configuração OAuth](docs/AI-OAUTH.md).

## Segurança

O projeto inclui as seguintes proteções:

- Senhas com scrypt e mínimo de 12 caracteres para novas credenciais.
- Sessão assinada, `HttpOnly`, `SameSite=Lax`, `Secure` em produção e expiração
  validada também no servidor.
- Autorização por papel e por proprietário nas operações sensíveis.
- Rate limit em login, recuperação de senha, IA e autorização de uploads.
- Anexos privados, tipos permitidos e nomes aleatórios no armazenamento.
- Rotas de cron fechadas quando `CRON_SECRET` não está configurado.
- Chaves de IA cifradas com AES-256-GCM.
- Validação de destinos de IA para reduzir SSRF.
- Cabeçalhos contra clickjacking, MIME sniffing e permissões desnecessárias.
- CodeQL e Dependabot configurados em `.github/`.

Antes de publicar uma mudança:

```bash
npm test
npm run build
npm run security:audit
```

Para comunicar uma vulnerabilidade, não abra uma issue pública. Siga
[`SECURITY.md`](SECURITY.md).

## DeskHelper AI

O assistente aceita provedores opcionais como OpenAI, Anthropic, Gemini,
DeepSeek, Groq, Mistral, xAI, Cohere, OpenRouter, Ollama e servidores compatíveis
com a API da OpenAI.

A chave cadastrada por uma pessoa é cifrada no banco e ligada à conta. O
navegador recebe apenas uma identificação parcial; as rotas resolvem a chave no
servidor. Ações sugeridas pela IA são validadas novamente e só são executadas
após confirmação na interface.

## Deploy

1. Provisione um banco PostgreSQL e um armazenamento privado para anexos.
2. Configure na plataforma todos os valores do arquivo de exemplo.
3. Gere segredos independentes e mantenha-os fora do Git e dos logs.
4. Execute `npm run db:deploy` para sincronizar o schema sem carregar o seed.
5. Faça o deploy e valide login, autorização, anexos, e-mails e crons.

`npm run db:reset` e `npm run db:seed` são comandos destrutivos e exclusivos de
ambientes descartáveis.

## Scripts

- `npm run dev` — servidor local.
- `npm test` — testes unitários.
- `npm run build` — geração do Prisma Client e build do Next.js.
- `npm run db:push` — sincroniza o schema do banco.
- `npm run db:deploy` — sincroniza o schema sem inserir dados.
- `npm run db:seed` — recria dados fictícios com confirmação explícita.
- `npm run security:audit` — verifica vulnerabilidades de produção conhecidas.

## Contribuição

Abra uma issue antes de mudanças grandes. Pull requests devem ser pequenos,
explicar o impacto no banco e incluir testes para regras de autorização,
financeiro ou estoque. Nunca inclua dados reais em fixtures, screenshots, logs
ou mensagens de commit.
