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

### Obrigatorias para rodar localmente

| Key | Uso |
| --- | --- |
| `DATABASE_URL` | Conexao do Prisma com o banco de dados. Em desenvolvimento pode usar `file:./db.sqlite`. |
| `URL` | URL publica/base **unica** (`src/env.js`): app inteiro, **incluindo `back_urls` do Checkout Pro** (retorno apos pagamento) e links. Este valor vem sempre do `.env` (sem fallback automatico da Vercel). |
| `MERCADOPAGO_TOKEN` | Access token do Mercado Pago usado para criar preferencias e consultar pagamentos. |
| `CRON_SECRET` | Segredo usado no header `Authorization: Bearer <CRON_SECRET>` da rota `/api/cron`. |
| `NEXT_PUBLIC_CONVEX_URL` | URL `.convex.cloud` do deployment remoto de desenvolvimento. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | URL `.convex.site` do mesmo deployment, usada pelo proxy do Better Auth. |
| `NEXT_PUBLIC_SITE_URL` | Origem do frontend. Localmente, `http://localhost:3000`. |

**Producao vs tunel local (mesma chave `URL`):** defina explicitamente no `.env` a origem publica correta em cada ambiente. Para testar checkout com tunel (ngrok, Cloudflare Tunnel, etc.), no `.env` **local** use a origem HTTPS do tunel em `URL`, rode `pnpm dev` e crie a preferencia por esse backend — o Mercado Pago passa a redirecionar e enviar webhooks para o tunel. Nao e necessario definir `WEBHOOK_URL` quando a base publica for a mesma.

Em qualquer deploy (incluindo Vercel), `URL` deve ser definida explicitamente no `.env` com a origem publica correta do app.

### Pagamentos e webhooks

| Key | Uso |
| --- | --- |
| `WEBHOOK_SECRET` | Segredo usado para validar a assinatura do webhook do Mercado Pago. Configure em producao para nao usar o fallback local. |
| `WEBHOOK_URL` | Opcional. URL publica alternativa para o webhook, sem o path final. Se ausente, o app usa `URL`. |

As preferencias do Mercado Pago sao criadas com `/api/webhook?source_news=webhooks`, forçando Webhooks assinados. IPN legado (`topic`/`id`) nao e aceito pelo handler.

### Teste automatico de pagamentos

Use `pnpm test:payments` para rodar um teste E2E automatico sem agente de IA. O teste cria uma preferencia real no Mercado Pago, grava um voucher pendente no banco e confere nome, telefone, quantidades, codigo e `preference_id`.

### Dados para teste de pagamento (Mercado Pago Sandbox)

Para realizar testes manuais de compra no Checkout do Mercado Pago em ambiente sandbox:

> [!IMPORTANT]
> **Atenção:** Para testar o pagamento, **deve-se fazer login na conta de teste antes** de prosseguir com o pagamento (recomenda-se utilizar uma janela anônima para evitar conflitos de sessão com a conta real ou de vendedor do Mercado Pago).

#### Conta de teste (Buyer Test User)

| Campo | Valor |
| --- | --- |
| Perfil | Comprador (`Buyer Test User`) |
| País | Brasil |
| User ID | `1915367917` |
| Usuário | `TESTUSER1953398469` |
| Senha | `MuFMnTEBR3` |
| Código de verificação | `367917` |

#### Cartão de crédito de teste

| Campo | Valor |
| --- | --- |
| Bandeira | Mastercard |
| Número | `5480 8328 0103 3311` |
| Código de segurança | `123` |
| Data de validade | `11/30` |
| Nome do titular | `APRO` (status: pagamento aprovado) |
| CPF | `12345678909` |

### Precos e comportamento publico

| Key | Padrao | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_MAX_INTENDED_DAYS` | `30` | Limite de dias para datas pretendidas de voucher. |
| `NEXT_PUBLIC_VOUCHER_PRICE` | `50` | Preco base do voucher adulto. |
| `NEXT_PUBLIC_POOL_VOUCHER_PRICE` | `70` | Preco base do voucher com piscina. |
| `NEXT_PUBLIC_ALERT_MESSAGE` | Nao definido | Mensagem publica opcional de alerta no app. |
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

O acesso em `/admin` usa Better Auth com usuario e senha. Os dados e sessoes ficam no deployment remoto do Convex, inclusive durante o desenvolvimento local.

Configure o deployment Convex selecionado uma vez:

```bash
pnpm exec convex env set SITE_URL http://localhost:3000
pnpm exec convex env set BETTER_AUTH_SECRET "<segredo-aleatorio-de-32-bytes>"
pnpm exec convex env set MERCADOPAGO_TOKEN "<access-token-do-mercadopago>"
pnpm exec convex env set MERCADOPAGO_WEBHOOK_SERVICE_SECRET "<segredo-de-servico-webhook>"
pnpm exec convex env set URL "https://seu-dominio-ou-tunel"
pnpm exec convex dev --once
```

Crie o primeiro admin pela funcao interna. O comando recusa a operacao quando ja existe qualquer usuario:

```bash
pnpm exec convex run authAdmin:createFirstAdmin '{"username":"admin","password":"uma-senha-longa"}'
```

Depois disso, o admin gerencia usuarios em `/admin/dashboard/usuarios`. Cada usuario altera o proprio acesso em `/admin/conta`.
