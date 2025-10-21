# Cachoeira das Araras - Sistema de Vouchers

Sistema de gerenciamento de vouchers para Cachoeira das Araras.

## Funcionalidades

### Admin Dashboard

- **Configurações**: Interface para gerenciar configurações do sistema
  - Preços de vouchers (normal e piscina)
  - Limites de dias e pessoas
  - Mensagens do sistema
  - Controles de habilitação de compras
- **Vendas**: Relatórios e gestão de vendas
- **Vouchers**: Gerenciamento de vouchers criados

### Sistema de Vouchers

- Compra de vouchers com diferentes opções
- Validação de vouchers
- Integração com Mercado Pago e Getnet (Link de Pagamento)
- Sistema de referência

## Pagamentos

O sistema suporta múltiplos provedores de pagamento através da variável `PAYMENT_PLATFORM` (`mp` ou `getnet`).

### Variáveis de ambiente (arquivo `.env`)

```env
# Seleciona o provedor padrão
PAYMENT_PLATFORM=getnet

# Mercado Pago
MERCADOPAGO_TOKEN=
WEBHOOK_URL=
WEBHOOK_SECRET=

# Getnet (Link de Pagamento)
GETNET_SELLER_ID=
GETNET_CLIENT_ID=
GETNET_CLIENT_SECRET=
GETNET_BASE_URL=https://api.getnet.com.br
```

- `GETNET_CLIENT_ID` e `GETNET_CLIENT_SECRET` são obrigatórios para solicitar o token OAuth.
- Se `GETNET_SELLER_ID` não for informado, o sistema utiliza `SELLER_ID` como fallback.
- `GETNET_BASE_URL` mantém o endpoint oficial informado pela Getnet (sem ambiente sandbox).

### Webhooks

- Defina `WEBHOOK_URL` no painel do Mercado Pago com o endpoint `/api/webhook` e configure `WEBHOOK_SECRET` para validar a assinatura.
- Para Getnet, informe `GETNET_WEBHOOK_SECRET` (opcional, porém recomendado) e cadastre o endpoint `/api/webhook` na plataforma.
- O serviço identifica o provedor automaticamente com base nos cabeçalhos enviados (`x-signature` para Mercado Pago e `x-gnet-signature` para Getnet).

### Fluxo interno

- `src/server/payments` concentra a lógica de criação e consulta de pagamentos (Mercado Pago e Getnet).
- `src/server/api/routers/payments.ts` expõe um endpoint único (`payments.create` e `payments.status`).
- O formulário (`src/app/_components/voucher-form.tsx`) consome esse endpoint, armazenando `payment_provider`, `payment_id` e `payment_url` por voucher.
- A página de voucher (`/voucher`) atende tanto Getnet quanto Mercado Pago.

### Test Mode

- Acesse `/test__` para testar o fluxo de compra em modo de teste
- Nome do comprador é preenchido automaticamente com "--TESTE--"
- Preço fixo de R$ 0,01 independente da quantidade selecionada
- Cria vouchers reais com preço de teste no Mercado Pago

---

# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## Facebook Pixel & Google Analytics Integration

This project includes conversion tracking for both Facebook Pixel and Google Analytics when payment events occur. When a payment is approved through MercadoPago, conversion events are automatically sent to both platforms.

### Environment Variables Required

Add these environment variables to your deployment:

```env
# Facebook Pixel (required)
FACEBOOK_PIXEL_ID=your_pixel_id_here
FACEBOOK_ACCESS_TOKEN=your_access_token_here

# Google Analytics 4 (optional)
GOOGLE_ANALYTICS_MEASUREMENT_ID=G-XXXXXXXXXX
GOOGLE_ANALYTICS_API_SECRET=your_api_secret_here
```

### How it works

1. When a webhook is received from MercadoPago for an approved payment
2. The system validates the payment status and extracts the payer's email
3. **Facebook Pixel**:
   - Email is hashed using SHA256 for privacy compliance
   - A "Purchase" event is sent to Facebook's Conversions API with transaction details
4. **Google Analytics**:
   - A "purchase" event is sent to Google Analytics 4 Measurement Protocol
   - Includes transaction details, item information, and conversion tracking

### Files involved

- `src/lib/utils/webhook-pixel.ts` - Main utility for sending Facebook Pixel and Google Analytics events
- `src/app/api/webhook/route.ts` - Webhook endpoint that triggers the conversion events
- `src/env.js` - Environment variable configuration
- `test-simple.js` - Test file for validating both integrations

### Webhooks

- Configure o endpoint de webhook em `WEBHOOK_URL` para receber notificações do Mercado Pago.
- Para Getnet, defina o `GETNET_WEBHOOK_SECRET` e aponte o webhook da plataforma para `/api/webhook`.
