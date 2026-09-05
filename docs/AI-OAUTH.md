# Conexão de provedores de IA

Em **Configurações → Inteligência Artificial**, conecte uma conta compatível,
carregue modelos e escolha o provedor principal. OAuth autoriza o uso de IA;
não é login no ERP e não muda as permissões do usuário.

## Disponibilidade nesta versão

| Provedor | Autenticação implementada no ERP |
| --- | --- |
| OpenRouter | OAuth PKCE ou chave manual. O OAuth gera uma chave delegada sem copiar/colar. |
| Google Gemini | OAuth com renovação automática ou chave manual. Exige Google Cloud. |
| OpenAI / GPT | Chave da API. Assinatura ChatGPT via Codex ainda não integrada. |
| Anthropic / Claude | Chave da API. Fluxos do CLI e de federação não integrados. |
| DeepSeek, Groq, Mistral, xAI, Cohere | Chave da API; OAuth de conta não implementado. |
| Ollama, servidor próprio | Acesso ao servidor local/compatível, sem OAuth. |

Não há um fluxo OAuth universal. OAuth de conectores (Gmail, Drive etc.) não
substitui a autenticação da API do modelo. O login ChatGPT documentado pelo
[Codex App Server](https://developers.openai.com/codex/app-server/) exige outra
arquitetura: processo Codex, autenticação e isolamento por usuário. Não basta
enviar esse token ao endpoint de chat da API OpenAI. Esta versão não executa
Codex no servidor nem reutiliza credenciais do computador do administrador.

## Configuração comum

Configure apenas no ambiente do servidor:

```dotenv
APP_URL="https://erp.example.com"
AI_ENCRYPTION_KEY="gere-um-segredo-longo-e-aleatorio"
```

`APP_URL` deve ser a origem exata acessada pelo navegador, sem caminho, query
ou fragmento. HTTPS é obrigatório em produção. Em desenvolvimento é aceito
`http://localhost:3000` ou outra porta configurada. Sem origem válida ou segredo
de criptografia, o botão fica desabilitado. Não use `NEXT_PUBLIC_` para segredos.
Não altere uma chave mestre existente: isso invalida as credenciais cifradas.

## OpenRouter

Não exige client ID/secret. Clique em **Conectar com OpenRouter** e autorize no
site do provedor. O retorno é `https://erp.example.com/api/ai/oauth/openrouter`.
O ERP acrescenta `state` aleatório ao callback e faz a troca com PKCE S256 no
servidor. A chave delegada é cifrada por usuário e usa saldo, limites e permissões
do OpenRouter, **não a assinatura ChatGPT ou Claude**. Configure limites de gasto
no provedor. Para usar modelos GPT do OpenRouter, selecione **OpenRouter**.

Referência: [OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth).

## Google Gemini

1. Crie/selecione um projeto Google Cloud e habilite a **Generative Language API**.
2. Configure o consentimento OAuth e usuários de teste, ou conclua a publicação
   e verificação exigidas pelo Google para sua audiência.
3. Crie cliente OAuth **Aplicativo da Web**, não Desktop.
4. Cadastre exatamente `https://erp.example.com/api/ai/oauth/gemini` como redirect URI.
5. Configure no servidor e reinicie/reimplante:

   ```dotenv
   GOOGLE_AI_OAUTH_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
   GOOGLE_AI_OAUTH_CLIENT_SECRET="seu-client-secret"
   GOOGLE_AI_PROJECT_ID="seu-projeto-google-cloud"
   ```

6. Garanta que as contas autorizadas possam consumir a API no projeto de cota
   (`serviceusage.services.use`, por exemplo via papel Service Usage Consumer).
   Configure cota e faturamento conforme o modelo utilizado.
7. Clique **Conectar com Google**, conceda a permissão, carregue modelos e teste.

É solicitado `https://www.googleapis.com/auth/cloud-platform`, com acesso
offline para renovar o token. **Esse escopo é amplo**: use projeto dedicado e
contas com permissões IAM mínimas. Não são pedidos e-mail, perfil, Drive ou Gmail.
Os tokens só são enviados ao endpoint oficial Gemini; `x-goog-user-project`
identifica o projeto de cota. OAuth não torna o uso gratuito nem reutiliza a
assinatura do aplicativo Gemini.

Apps Google externos em teste podem ter refresh tokens de curta duração.
Revogação e mudanças de consentimento/client secret podem exigir reconexão.
O ERP mantém o refresh token cifrado e renova o access token antes da expiração.

Referências: [Gemini OAuth](https://ai.google.dev/gemini-api/docs/oauth) e
[OAuth Google para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server).

## Segurança e operação

- Início por POST autenticado com validação de origem; retorno confere provedor,
  usuário, sessão, estado e prazo de dez minutos.
- PKCE S256; estado temporário cifrado em cookie HttpOnly, SameSite=Lax e Secure
  em produção. Códigos de autorização são trocados somente no servidor.
- Autorizar substitui apenas a credencial daquele usuário/provedor.
- Sem tabela nova: chaves antigas continuam válidas; envelopes OAuth versionados
  ficam cifrados em `AICredential.keyCipher`.
- OAuth ignora URLs personalizadas, inclusive na listagem e teste de modelos,
  e não segue redirects nos pedidos com tokens.
- Callback redireciona para URL limpa e não registra códigos/tokens. Configure
  proxy e observabilidade para não registrar queries em `/api/ai/oauth/*`.
- **Desconectar** remove a credencial do ERP, mas não revoga no provedor. Revogue
  também na conta Google ou exclua a chave no OpenRouter. A chave corporativa do
  ambiente, se existir, volta a ser usada como fallback.
- Os testes simulam troca e renovação. Valide o login real após configurar seu
  ambiente. O teste de modelos pode consumir cota.

## Diagnóstico

- Botão desabilitado: confira variáveis e origem usada pelo navegador.
- `redirect_uri_mismatch`: confira domínio, HTTPS, porta e caminho no Google.
- Retorno expirado/inválido: inicie de novo na mesma sessão; não compartilhe links.
- Erro 403 Gemini: confira API, consentimento, IAM e projeto de cota.
- Falha de renovação: reconecte; não cole refresh tokens no campo de chave.
