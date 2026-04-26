# Cachoeira das Araras — Sistema de Vouchers

Este repositório contém o website de venda e gestão de vouchers da Cachoeira das Araras.

## Documentação principal

A documentação foi organizada em múltiplos arquivos na pasta [`docs/`](./docs/README.md), com foco em manutenção por solo dev:

- visão do produto e fluxos;
- arquitetura técnica;
- mapa de rotas;
- modelo de dados e settings;
- playbook de manutenção.

## Comandos

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test:payments
pnpm type-check
pnpm build
```

## Variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto usando `.env.example` como base. O schema principal fica em `src/env.js`; variaveis vazias sao tratadas como ausentes.

### Obrigatorias para rodar

| Key | Uso |
| --- | --- |
| `DATABASE_URL` | Conexao do Prisma com o banco de dados. Em desenvolvimento pode usar `file:./db.sqlite`. |
| `URL` | URL publica/base **unica** (`src/env.js`): app inteiro, **incluindo `back_urls` do Checkout Pro** (retorno apos pagamento), links e fallback do NextAuth. |
| `MERCADOPAGO_TOKEN` | Access token do Mercado Pago usado para criar preferencias e consultar pagamentos. |
| `WEBHOOK_URL` | URL publica que o Mercado Pago chama no webhook, sem o path final. Exemplo: `https://seudominio.com`. |
| `CRON_SECRET` | Segredo usado no header `Authorization: Bearer <CRON_SECRET>` da rota `/api/cron`. |

**Producao vs tunel local (mesma chave `URL`):** no Vercel, defina `URL` como o site de producao. Para testar checkout com tunel (ngrok, Cloudflare Tunnel, etc.), no `.env` **local** use a origem HTTPS do tunel em `URL` e em `WEBHOOK_URL` (mesma base publica), rode `pnpm dev` e crie a preferencia por esse backend — o Mercado Pago passa a redirecionar para o tunel. Nao e necessaria segunda variavel de ambiente para isso.

### Obrigatorias em producao

| Key | Uso |
| --- | --- |
| `NEXTAUTH_SECRET` | Segredo de sessao do NextAuth. Gere com `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | URL explicita do NextAuth. Opcional quando `URL` ja aponta para a base publica correta. |
| `ADMIN_PASSWORD_HASH` | Hash da senha do admin no formato `scrypt:<salt>:<derived-key-hex>`. |

### Acesso interno opcional

| Key | Uso |
| --- | --- |
| `EMPLOYEE_PASSWORD_HASH` | Hash da senha de funcionario. Se ausente, somente o acesso admin fica disponivel. |

### Pagamentos e webhooks

| Key | Uso |
| --- | --- |
| `WEBHOOK_SECRET` | Segredo usado para validar a assinatura do webhook do Mercado Pago. Configure em producao para nao usar o fallback local. |

### Teste automatico de pagamentos

Use `pnpm test:payments` para rodar um teste E2E automatico sem agente de IA. O teste cria uma preferencia real no Mercado Pago, grava um voucher pendente no banco e confere nome, telefone, quantidades, codigo e `preference_id`.

### Precos e comportamento publico

| Key | Padrao | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_MAX_INTENDED_DAYS` | `30` | Limite de dias para datas pretendidas de voucher. |
| `NEXT_PUBLIC_VOUCHER_PRICE` | `50` | Preco base do voucher adulto. |
| `NEXT_PUBLIC_POOL_VOUCHER_PRICE` | `70` | Preco base do voucher com piscina. |
| `NEXT_PUBLIC_ALERT_MESSAGE` | Nao definido | Mensagem publica opcional de alerta no app. |
| `NEXT_PUBLIC_DATA_SAVER` | `false` | Reduz autoplay e quantidade de itens em carrosseis. |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `false` | Liga ou desliga o Vercel Analytics no layout. |
| `NEXT_PUBLIC_VERCEL_URL` | Nao definido | URL publica de preview do Vercel usada como fallback para imagens/links. Normalmente preenchida pela plataforma. |
| `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` | Nao definido | URL publica de producao do projeto no Vercel usada como fallback para imagens/links. Normalmente preenchida pela plataforma. |

### Marketing e notificacoes opcionais

| Key | Uso |
| --- | --- |
| `FACEBOOK_PIXEL_ID` | Pixel ID usado no envio de conversoes pelo webhook. |
| `FACEBOOK_ACCESS_TOKEN` | Token da Conversions API do Facebook. |
| `GOOGLE_ANALYTICS_MEASUREMENT_ID` | Measurement ID usado no Measurement Protocol do GA4. |
| `GOOGLE_ANALYTICS_API_SECRET` | API secret usado no Measurement Protocol do GA4. |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Pixel ID exposto no client por `src/lib/fbpixel.js`, se essa integracao for usada. |
| `TWILIO_ACCOUNT_SID` | SID da conta Twilio para envio de WhatsApp pelo admin. |
| `TWILIO_AUTH_TOKEN` | Token da conta Twilio para envio de WhatsApp pelo admin. |

## Autenticacao do admin

O acesso em `/admin` usa sessao do NextAuth com provider de credenciais.

- Defina `ADMIN_PASSWORD_HASH` no `.env`.
- O formato esperado e `scrypt:<salt>:<derived-key-hex>`.
- Para gerar o hash localmente, use o comando abaixo em PowerShell ou Bash:

```bash
pnpm admin:hash -- "sua-senha-admin"
```
