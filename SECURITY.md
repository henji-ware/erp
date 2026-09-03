# Política de segurança

## Versões suportadas

Somente a versão mais recente da branch `main` recebe correções de segurança.

## Como relatar uma vulnerabilidade

Não abra uma issue pública e não publique provas de conceito que exponham dados.
Use **Security → Advisories → Report a vulnerability** neste repositório para
enviar o relato de forma privada.

Inclua, quando possível:

- descrição e impacto;
- passos mínimos para reprodução;
- versão ou commit afetado;
- sugestão de correção;
- indicação de qualquer dado que possa ter sido exposto.

Evite acessar, alterar ou baixar dados de terceiros durante a investigação.
Credenciais encontradas devem ser consideradas comprometidas e jamais incluídas
no relato; informe apenas o tipo e onde elas apareceram.

## Segredos expostos

Remover um segredo do Git não o torna seguro novamente. Se uma chave, senha ou
token entrar em um commit, revogue ou rotacione o valor no provedor, remova-o do
histórico e revise logs de uso.

## Escopo

São especialmente relevantes falhas de autenticação ou autorização, acesso a
anexos privados, injeção, SSRF, execução indevida de ações da IA, exposição de
segredos e operações financeiras ou de estoque sem permissão.
