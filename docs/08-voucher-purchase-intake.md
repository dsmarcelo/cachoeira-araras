# 08 — Voucher Purchase Intake

## Objetivo

Centralizar o inicio da compra de voucher em um modulo server-side profundo.

Antes, o formulario publico precisava coordenar:

- geracao do codigo curto do voucher;
- criacao da preference no Mercado Pago;
- criacao do voucher pendente no banco;
- preco inicial do voucher;
- estado inicial `pending` / `valid: false`;
- atribuicao opcional de referrer.

Agora o formulario chama uma unica mutation publica:

- `voucher.startCheckout`

Ela retorna:

- `code`
- `preferenceId`
- `initPoint`
- `price`

## Regra arquitetural

O caller publico nao deve enviar estado autoritativo do voucher.

Campos server-owned:

- `code`
- `price`
- `status`
- `valid`
- `preference_id`

O caller envia apenas dados de entrada da compra:

- nome;
- telefone;
- quantidades;
- data pretendida;
- `testMode`, quando aplicavel;
- `referrerUrl`, opcional.

## Arquivos principais

- `src/server/voucher-purchase-intake-core.ts`
- `src/server/voucher-purchase-intake.ts`
- `src/server/voucher-purchase-intake.test.ts`
- `src/server/api/routers/voucher.ts`
- `src/app/_components/voucher-form.tsx`

## Como funciona

### 1. Formulario publico

`src/app/_components/voucher-form.tsx` chama:

```ts
api.voucher.startCheckout.useMutation()
```

O formulario continua responsavel por:

- coletar dados do cliente;
- exibir preco estimado usando settings;
- salvar o codigo retornado em cookie;
- mostrar o card com botao para finalizar pagamento.

O formulario nao monta mais o payload completo do voucher.

### 2. Router tRPC

`src/server/api/routers/voucher.ts` expoe:

```ts
voucher.startCheckout
```

Essa mutation valida o formato basico do input e delega a regra de negocio para o modulo de intake.

### 3. Modulo de intake

`src/server/voucher-purchase-intake.ts` conecta a regra de negocio aos adapters reais:

- Prisma para `Voucher`;
- Prisma para `Referrer`;
- Mercado Pago SDK para preference;
- settings do banco;
- Sentry para erro no fluxo de pagamento.

`src/server/voucher-purchase-intake-core.ts` contem o fluxo testavel:

1. busca settings;
2. valida a compra com `validateVoucherPurchase`;
3. gera codigo curto no servidor;
4. rejeita colisao antes de criar preference;
5. cria preference Mercado Pago;
6. persiste voucher pendente com `status: "pending"` e `valid: false`;
7. registra referrer se existir;
8. retorna dados de checkout para o caller.

## Decisoes importantes

### Preference orfa

Mercado Pago e I/O externo e nao entra na mesma transacao do banco.

Se a preference for criada e a persistencia do voucher falhar, o modulo registra erro com:

```txt
Voucher checkout preference created without voucher
```

Nao ha rollback automatico da preference. Isso evita simular atomicidade que o sistema nao tem.

### Codigo curto

O codigo do voucher continua com 4 caracteres por compatibilidade operacional.

A geracao e o retry por colisao ficam server-side. O caller nao conhece o algoritmo.

### Referrer

Referrer e efeito colateral opcional.

Falha ao gravar referrer nao bloqueia checkout. O erro e registrado como warning.

### Test mode

`testMode` continua protegido por permissao de admin/employee via sessao tRPC.

## Testes

Teste focado:

```bash
node --import ts-node/register --test src/server/voucher-purchase-intake.test.ts
```

Suite relacionada:

```bash
node --import ts-node/register --test src/server/voucher-purchase-intake.test.ts src/server/voucher-purchase.test.ts src/server/mercadopago-webhook.test.ts
```

O teste cobre:

- estado inicial server-owned;
- preco derivado de settings;
- retry de colisao de codigo antes da preference;
- referrer nao bloqueante;
- classificacao de referrer.

## Validacao executada

Durante a implementacao:

```bash
pnpm type-check
pnpm exec eslint src/server/voucher-purchase-intake-core.ts src/server/voucher-purchase-intake.ts src/server/api/routers/voucher.ts src/app/_components/voucher-form.tsx
node --import ts-node/register --test src/server/voucher-purchase-intake.test.ts src/server/voucher-purchase.test.ts src/server/mercadopago-webhook.test.ts
```

`pnpm lint` completo ainda falha por arquivos `.pi/gsd/hooks/*.js` fora do escopo do projeto TypeScript. Os arquivos alterados passam no lint focado.

## Follow-up recomendado

- Remover ou migrar callers antigos de `mercadopago.create` + `voucher.create`.
- Decidir se `.pi/` deve ser excluido do lint ou incluido corretamente no projeto ESLint/TypeScript.
- Considerar um alerta operacional para preferences criadas sem voucher persistido.
