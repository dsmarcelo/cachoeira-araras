# 06) Consolidar Mercado Pago

## Prioridade

Baixa isoladamente; media se for feito junto com o webhook ou com manutencao do checkout.

## Status atual

Parcialmente aplicado.

## Confirmado no codigo

- `src/server/mercadopago.ts` ja centraliza chamadas server-only para buscar preference, payment e payments por `external_reference`.
- `src/app/api/webhook/route.ts` usa `getMercadoPagoPayment()` desse servico.
- `src/server/api/routers/voucher.ts` usa `searchMercadoPagoPaymentsByExternalReference()` para reconciliacao publica.
- `src/server/api/routers/mercadopago.ts` ainda faz `fetch()` direto para `getPreference`, `getPublicPreference`, `getPreferenceByEReference` e `getPayment`.
- A criacao de preference continua usando SDK/checkout em `src/server/api/routers/mercadopago.ts` e `src/server/mercadopago-checkout.ts`.

## Por que ainda faz sentido

- A consolidacao principal ja comecou, entao o trabalho restante e menor e menos arriscado.
- Ainda existem chamadas HTTP diretas duplicadas no router tRPC.
- Padronizar retorno e tratamento de erro evita divergencia entre webhook, admin e fluxo publico.

## Arquivos principais

- `src/server/api/routers/mercadopago.ts`
- `src/server/mercadopago.ts`
- `src/server/mercadopago-checkout.ts`
- `src/app/api/webhook/route.ts`

## Implementacao recomendada

- Manter procedures tRPC finas.
- Substituir fetch direto no router por `getMercadoPagoPreference()` e `getMercadoPagoPayment()`.
- Criar, se necessario, `searchMercadoPagoPreferencesByExternalReference()` no servico antes de alterar `getPreferenceByEReference`.
- Preservar contratos publicos atuais, especialmente `getPublicPreference` retornando apenas `{ init_point }`.
- Avaliar em etapa separada se a criacao de preference deve sair do router; nao misturar essa mudanca com a remocao dos fetches diretos.

## Teste funcional minimo

- Criar uma preference pelo fluxo de compra.
- Recuperar uma preference publica e confirmar que `init_point` continua funcionando.
- Buscar payment/preference em admin, se a tela ainda usa essas queries.
- Confirmar que o webhook continua conseguindo buscar pagamento aprovado.

## Checklist

- [ ] Fetches diretos restantes removidos do router tRPC
- [ ] Contratos publicos preservados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
