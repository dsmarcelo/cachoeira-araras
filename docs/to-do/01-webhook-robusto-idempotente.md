# 01) Fechar lacunas restantes do webhook Mercado Pago

## Prioridade

Alta.

## Status atual

Parcialmente aplicado.

## Confirmado no codigo

- `src/app/api/webhook/route.ts` nao usa mais fallback como `"your-secret-key"`.
- `WEBHOOK_SECRET` e obrigatorio em producao no schema de env.
- `x-signature` e `data.id` ausentes retornam 400.
- A confirmacao de pagamento foi centralizada em `src/server/voucher.ts`.
- Eventos de Meta/Google so sao disparados quando o voucher pendente vira valido (`updateResult.count > 0`).
- Ja existe teste focado em `src/server/mercadopago-webhook.test.ts`.

## Por que ainda faz sentido

- `x-request-id` ainda nao e rejeitado quando ausente, embora a assinatura oficial do Mercado Pago use esse valor no manifesto.
- A rota ainda deixa a validacao de segredo falhar como 500 se `WEBHOOK_SECRET` estiver ausente em ambiente nao-producao. Isso e aceitavel para dev, mas ruim para teste funcional e diagnostico.
- Falta cobrir explicitamente em teste/regressao a rejeicao de headers obrigatorios pela rota HTTP, nao apenas o processamento isolado.

## Arquivos principais

- `src/app/api/webhook/route.ts`
- `src/server/mercadopago-webhook.ts`
- `src/server/mercadopago-webhook.test.ts`
- `src/server/voucher.ts`
- `src/env.js`

## Implementacao recomendada

- Validar `x-request-id` em `POST()` e retornar 400 quando faltar.
- Manter `x-signature` e `data.id` como 400 quando ausentes.
- Decidir se `WEBHOOK_SECRET` deve ser obrigatorio tambem fora de producao; se nao, manter o 500 atual documentado para ambientes sem segredo.
- Adicionar teste para assinatura com `x-request-id` ausente e para reentrega do mesmo pagamento aprovado sem duplicar eventos.
- Nao reabrir a arquitetura de idempotencia ja feita, a menos que o modelo passe a registrar eventos externos em tabela propria.

## Teste funcional minimo

- Enviar webhook sem `x-signature` e confirmar 400.
- Enviar webhook sem `x-request-id` e confirmar 400.
- Enviar webhook sem `data.id` e confirmar 400.
- Enviar webhook com assinatura invalida e confirmar 400.
- Processar o mesmo pagamento aprovado duas vezes e confirmar que voucher e eventos externos nao duplicam.

## Checklist

- [ ] Rejeicao de `x-request-id` ausente aplicada
- [ ] Testes/regressao adicionados ou atualizados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
