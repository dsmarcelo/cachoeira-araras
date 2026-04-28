# 07 — Sentry e Monitoramento do Fluxo de Pagamento

Este documento descreve a integração do **Sentry** adicionada ao projeto, com foco principal no fluxo de pagamento via **Mercado Pago**.

## Objetivo

A integração foi feita para responder rapidamente perguntas como:

- A preferência de checkout foi criada com sucesso?
- O usuário voltou do Mercado Pago com parâmetros válidos?
- A API do Mercado Pago respondeu erro ou indisponibilidade?
- O webhook foi recebido, validado e processado?
- O voucher foi confirmado após pagamento aprovado?
- Falhas em Meta Pixel / Google Ads estão afetando ou não o pagamento?

O foco é **observabilidade do pagamento**, sem registrar dados sensíveis do comprador.

## Arquivos principais

### Setup global do Sentry

- `instrumentation.ts`  
  Registra o Sentry no runtime correto do Next.js (`nodejs` ou `edge`) e exporta `onRequestError`.

- `instrumentation-client.ts`  
  Inicializa o Sentry no browser e registra transições do App Router.

- `sentry.server.config.ts`  
  Inicialização server-side. Remove headers sensíveis antes do envio (`authorization`, `cookie`, `x-signature`).

- `sentry.edge.config.ts`  
  Inicialização para runtime edge, caso seja usado.

- `src/app/global-error.tsx`  
  Captura erros globais de renderização no App Router e mostra uma tela amigável ao usuário.

- `next.config.js`  
  Usa `withSentryConfig()` para integrar o Sentry ao build do Next.js e habilitar upload de sourcemaps quando `SENTRY_AUTH_TOKEN` existir.

### Helpers específicos do fluxo de pagamento

- `src/lib/sentry/payment.ts`

Este arquivo centraliza a instrumentação do fluxo de pagamento:

- `capturePaymentFlowException(...)` — captura exceções com tags/contexto de pagamento.
- `capturePaymentFlowMessage(...)` — registra alertas sem exceção.
- `startPaymentFlowSpan(...)` — cria spans para etapas críticas.

As tags principais enviadas ao Sentry são:

- `payment.provider = mercadopago`
- `payment.flow_step = ...`
- `payment.*` para contexto seguro, como `paymentId`, `preferenceId`, `voucherCode`, `status`, `path`.

O helper sanitiza chaves sensíveis por padrão, incluindo termos como:

- `authorization`
- `cookie`
- `email`
- `name`
- `phone`
- `secret`
- `signature`
- `surname`
- `token`

## Etapas instrumentadas

### 1) Criação de preferência de pagamento

Arquivo:

- `src/server/api/routers/mercadopago.ts`

Etapa Sentry:

- `create_preference`

O que é monitorado:

- criação da preferência no Mercado Pago;
- preço calculado;
- quantidades compradas;
- data pretendida;
- modo de teste;
- exceções ao chamar o SDK/API do Mercado Pago.

Importante: dados pessoais do comprador não são enviados ao Sentry.

### 2) Busca de preferência e pagamento no Mercado Pago

Arquivo:

- `src/server/mercadopago.ts`

Etapas Sentry:

- `fetch_preference`
- `fetch_payment`

O que é monitorado:

- chamadas à API do Mercado Pago;
- status HTTP não-OK;
- erros 5xx;
- caminho da API consultada, sem token.

### 3) Retorno do usuário após checkout

Arquivos:

- `src/app/(client)/pagamento/page.tsx`
- `src/app/(client)/pagamento/aprovado/page.tsx`

Etapa Sentry:

- `payment_return`

O que é monitorado:

- querystring inválida;
- `preference_id` ou `payment_id` ausentes;
- preferência não encontrada;
- pagamento não encontrado;
- pagamento aprovado, mas voucher não confirmado.

### 4) Confirmação do voucher

Arquivo:

- `src/lib/voucher/server-utils.ts`

Etapa Sentry:

- `confirm_voucher`

O que é monitorado:

- busca do voucher por `preference_id`;
- confirmação por código;
- pagamento aprovado sem voucher correspondente;
- falhas inesperadas no processo de confirmação.

### 5) Webhook do Mercado Pago

Arquivo:

- `src/app/api/webhook/route.ts`

Etapa Sentry:

- `webhook`

O que é monitorado:

- erro inesperado no processamento do webhook;
- falha em eventos auxiliares de conversão;
- integração que falhou (`facebook_pixel` ou `google_ads`).

Observação: rejeições esperadas de webhook inválido continuam retornando `400` e sendo logadas com `console.warn`; elas não devem virar ruído no Sentry salvo se houver exceção inesperada.

## Variáveis de ambiente

As variáveis foram adicionadas a `.env.example` e validadas em `src/env.js` quando aplicável.

### Essenciais para capturar eventos

```env
NEXT_PUBLIC_SENTRY_DSN="..."
SENTRY_DSN="..."
```

- `NEXT_PUBLIC_SENTRY_DSN`: habilita captura no browser. É seguro ser público.
- `SENTRY_DSN`: habilita captura server-side. Pode ser o mesmo DSN.

### Ambiente e amostragem

```env
SENTRY_ENVIRONMENT="production"
NEXT_PUBLIC_SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE="0.1"
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="0.05"
```

- `SENTRY_ENVIRONMENT`: ambiente no Sentry para server.
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT`: ambiente no Sentry para browser.
- `SENTRY_TRACES_SAMPLE_RATE`: amostragem de traces server-side, de `0` a `1`.
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`: amostragem de traces client-side, de `0` a `1`.

Valores atuais sugeridos:

- server: `0.1` — 10% dos traces;
- client: `0.05` — 5% dos traces.

Ajuste temporariamente para `1.0` durante diagnóstico curto, se necessário.

### Upload de sourcemaps via Sentry CLI / build

```env
SENTRY_AUTH_TOKEN="..."
SENTRY_ORG="..."
SENTRY_PROJECT="..."
```

Essas variáveis são usadas no build para upload de sourcemaps.

Regras importantes:

- Não commitá-las com valores reais.
- Configurá-las no ambiente de CI/deploy.
- Se `SENTRY_AUTH_TOKEN` não existir, o upload de sourcemaps fica desabilitado pelo `next.config.js`.

## Como configurar no deploy

1. Criar ou selecionar projeto no Sentry para este site.
2. Copiar o DSN do projeto.
3. Definir no ambiente de produção:

```env
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_DSN="https://..."
SENTRY_ENVIRONMENT="production"
NEXT_PUBLIC_SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE="0.1"
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="0.05"
```

4. Para sourcemaps, também definir:

```env
SENTRY_AUTH_TOKEN="..."
SENTRY_ORG="..."
SENTRY_PROJECT="..."
```

5. Fazer novo build/deploy.

## Como validar

### Validação local sem enviar eventos reais

Com DSN vazio, o app deve continuar funcionando normalmente:

```bash
pnpm type-check
pnpm build
```

### Validação com Sentry ativo

Com DSN configurado:

1. Rodar o site.
2. Fazer uma compra de teste.
3. Confirmar no Sentry se aparecem transações/spans com:
   - `payment.flow_step:create_preference`
   - `payment.flow_step:fetch_payment`
   - `payment.flow_step:payment_return`
   - `payment.flow_step:confirm_voucher`
   - `payment.flow_step:webhook`, quando webhook for recebido.

### Testes executados após a implementação

Foram executados com sucesso:

```bash
pnpm type-check
pnpm test:webhook
pnpm test:payments
pnpm build
```

Resultado relevante:

- webhook: 22 testes passando;
- e2e de pagamento: preferência criada, voucher pendente persistido e dados do comprador conferidos;
- build Next.js concluído com sucesso.

## Como investigar problemas de pagamento no Sentry

### Pagamento não cria checkout

Filtrar por:

```text
payment.flow_step:create_preference
```

Verificar:

- exceção do SDK/API Mercado Pago;
- preço calculado;
- quantidades;
- `voucherCode`;
- se as regras de compra bloquearam antes da criação.

### Usuário pagou, mas não vê voucher

Filtrar por:

```text
payment.flow_step:payment_return
```

ou:

```text
payment.flow_step:confirm_voucher
```

Verificar:

- `preferenceId`;
- `paymentId`;
- se a API do Mercado Pago retornou pagamento;
- se o voucher foi encontrado por `preference_id`;
- se houve falha na confirmação por código.

### Webhook falhou

Filtrar por:

```text
payment.flow_step:webhook
```

Verificar:

- `path`;
- `sourceNews`;
- `paymentId`, quando disponível;
- falhas inesperadas no processamento;
- erros em conversões auxiliares.

### Conversão Meta/Google falhou

Filtrar por:

```text
payment.flow_step:webhook integration:facebook_pixel
```

ou:

```text
payment.flow_step:webhook integration:google_ads
```

Essas falhas não devem bloquear a confirmação do voucher.

## Boas práticas para futuras alterações

- Sempre usar `src/lib/sentry/payment.ts` para novos pontos do fluxo de pagamento.
- Não chamar `Sentry.captureException` diretamente em código de pagamento, a menos que haja motivo específico.
- Nunca enviar dados pessoais do comprador para o Sentry.
- Preferir IDs técnicos (`paymentId`, `preferenceId`, `voucherCode`) em vez de nome, telefone ou e-mail.
- Ao adicionar nova etapa, incluir um novo valor em `PaymentFlowStep`.
- Após alterar pagamento/webhook, rodar:

```bash
pnpm type-check
pnpm test:webhook
pnpm test:payments
pnpm build
```

## Pendências / TODO

- Fazer `src/app/admin/error.tsx` enviar erros ao Sentry, em vez de apenas `console.error`.
- Adicionar `Sentry.flush()` no `src/app/global-error.tsx` para reduzir risco de perda do evento em reload rápido.
- Revisar a compatibilidade entre `next@14.2.5` e `@sentry/nextjs@10.50.0` para garantir que o hook de instrumentação continue correto.

## Relação com o fluxo oficial de pagamento

A confirmação mais confiável continua sendo o webhook assinado do Mercado Pago:

- endpoint: `src/app/api/webhook/route.ts`;
- validação: `src/server/mercadopago-webhook.ts`;
- atualização do voucher: `src/server/voucher.ts`.

As páginas `/pagamento` e `/pagamento/aprovado` também tentam confirmar o voucher quando o usuário retorna do Mercado Pago, mas o webhook deve ser tratado como fonte assíncrona oficial.
