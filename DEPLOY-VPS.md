# Rodar o ERP da DRR em uma VPS

Guia para colocar o sistema numa VPS Linux (Ubuntu 22.04/24.04), acessível pela
internet e sempre ligado. Como a VPS tem **disco persistente**, o **SQLite** e os
**anexos em disco** continuam funcionando — não precisa de Postgres nem de nuvem.

> O sistema detecta automaticamente: **sem** `BLOB_READ_WRITE_TOKEN`, os anexos
> são salvos no disco da VPS (pasta `uploads/`). É só não definir essa variável.

---

## 0) Escolher uma VPS
~US$ 4–6/mês: **Hetzner**, **DigitalOcean**, **Contabo**, **Linode**, **AWS Lightsail**.
Crie uma instância **Ubuntu 22.04/24.04** (1 vCPU / 1–2 GB RAM bastam) e anote o
**IP público**. (Opcional) Aponte um domínio: registro **A** `erp.suaempresa.com.br → IP`.

## 1) Acessar
```bash
ssh root@IP_DA_VPS
```

## 2) Instalar Node.js 20 + Git
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git
node -v   # v20.x
```

## 3) Enviar o projeto
**Via Git (recomendado):** suba a pasta `erp-crm` para um repositório privado e:
```bash
mkdir -p /var/www && cd /var/www
git clone SEU_REPOSITORIO erp-crm
```
**Ou copie do seu PC** (rode no Windows, na pasta Downloads):
```powershell
scp -r erp-crm root@IP_DA_VPS:/var/www/erp-crm
```
> Não envie `node_modules`, `.next`, `prisma/dev.db` nem `uploads`.

## 4) Variáveis de ambiente
```bash
cd /var/www/erp-crm
node -e "console.log('SESSION_SECRET=\"'+require('crypto').randomBytes(48).toString('hex')+'\"')"
# copie a linha gerada para dentro do .env abaixo:
cat > .env <<'EOF'
DATABASE_URL="file:./dev.db"
SESSION_SECRET="COLE_A_CHAVE_GERADA_AQUI"
EOF
```
> **Não** defina `BLOB_READ_WRITE_TOKEN` — assim os anexos ficam no disco da VPS.

## 5) Instalar, criar o banco e compilar
```bash
npm install
npm run db:push      # cria as tabelas (SQLite)
npm run db:seed      # SÓ na 1ª vez (popula dados/usuários de exemplo)
npm run build
```

## 6) Manter rodando com PM2
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup          # rode o comando que ele imprimir (liga no boot)
```
Úteis: `pm2 status`, `pm2 logs erp-drr`, `pm2 restart erp-drr`.
O app fica em `http://127.0.0.1:3000` na VPS.

## 7) Nginx (porta 80/443) + HTTPS
```bash
apt-get install -y nginx
cp deploy/nginx-erp.conf /etc/nginx/sites-available/erp
# edite o arquivo e troque SEU_DOMINIO
ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/erp
nginx -t && systemctl reload nginx

apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d erp.suaempresa.com.br    # HTTPS grátis
```

## 8) Firewall
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```
> Não exponha a porta 3000 direto — o Nginx faz o proxy.

## ✅ Pronto
Acesse `https://erp.suaempresa.com.br` (ou `http://IP_DA_VPS` sem domínio).
Você e a outra pessoa entram com os logins e compartilham os mesmos dados.

---

## Atualizar depois (sem perder dados)
```bash
cd /var/www/erp-crm
git pull
npm install
npm run db:push        # aplica mudanças de schema (NUNCA use db:reset!)
npm run build
pm2 restart erp-drr
```
> O banco (`prisma/dev.db`) e os anexos (`uploads/`) ficam no disco e são preservados.

## Backup
```bash
cp prisma/dev.db ~/backup-$(date +%F).db
tar czf ~/uploads-$(date +%F).tgz uploads
```
