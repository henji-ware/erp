# Deploy seguro em VPS

Use este guia para uma VPS Linux mantida pela sua equipe. Para a opção gerenciada,
consulte [`DEPLOY.md`](DEPLOY.md).

## Pré-requisitos

- Ubuntu LTS atualizado.
- Usuário administrativo com `sudo`; login SSH direto como `root` desativado.
- Autenticação SSH por chave e firewall ativo.
- Node.js 22.6 ou superior, npm, Git, Nginx e PM2.
- PostgreSQL com backup e usuário exclusivo para a aplicação.
- Domínio apontando para a VPS.

Não use SQLite em produção. O schema atual do projeto exige PostgreSQL.

## Instalação

Clone o repositório com um usuário sem privilégios e restrinja as permissões:

```bash
sudo install -d -o erp -g erp -m 0750 /var/www/erp
sudo -u erp git clone https://github.com/henji-ware/erp.git /var/www/erp
cd /var/www/erp
sudo -u erp npm ci
```

Crie `/var/www/erp/.env` com permissão `0600` e os mesmos valores descritos em
[`.env.production.example`](.env.production.example). Não copie o arquivo para
logs, tickets ou comandos que fiquem no histórico do shell.

```bash
sudo chown erp:erp /var/www/erp/.env
sudo chmod 600 /var/www/erp/.env
```

Prepare e compile:

```bash
sudo -u erp npm run db:deploy
sudo -u erp npm run build
sudo -u erp pm2 start ecosystem.config.js
sudo -u erp pm2 save
```

> [!CAUTION]
> Nunca execute `db:seed` ou `db:reset` em produção. Ambos apagam dados.

## Nginx e HTTPS

Copie `deploy/nginx-erp.conf`, substitua `SEU_DOMINIO`, valide com
`nginx -t` e habilite HTTPS com Certbot. Exponha somente as portas 22, 80 e
443; a porta 3000 deve aceitar conexões apenas de `127.0.0.1`.

Depois de confirmar HTTPS, mantenha o redirecionamento permanente de HTTP para
HTTPS. O aplicativo já envia HSTS e outros cabeçalhos de segurança.

## Atualização

```bash
cd /var/www/erp
sudo -u erp git pull --ff-only
sudo -u erp npm ci
sudo -u erp npm run db:deploy
sudo -u erp npm run build
sudo -u erp pm2 restart erp-drr
```

Faça backup do banco e dos anexos antes de mudanças de schema. Teste
periodicamente a restauração; um backup nunca restaurado é apenas uma hipótese.

## Checklist operacional

- Atualizações automáticas de segurança do sistema operacional.
- SSH por chave, sem senha e sem login direto de `root`.
- PostgreSQL não exposto à internet.
- Segredos independentes e fora do Git.
- Backups cifrados, com retenção e teste de restauração.
- Logs sem credenciais, tokens ou dados pessoais desnecessários.
- Dependabot, CodeQL e alertas do GitHub revisados.
- Monitoramento de disponibilidade e espaço em disco.
