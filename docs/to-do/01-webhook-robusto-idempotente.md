# 01) Webhook robusto e idempotente

## Prioridade

Alta.

## Por que ainda faz sentido

- `src/app/api/webhook/route.ts` ainda usa fallback inseguro para `WEBHOOK_SECRET`.
- Headers e parametros obrigatorios sao acessados com `!`, o que pode transformar erro de entrada em 500.
- Reentregas do Mercado Pago podem repetir atualizacao de voucher e eventos de conversao.

## Arquivos principais

- `src/app/api/webhook/route.ts`
- `src/server/voucher.ts`
- `src/server/mercadopago.ts`
- `src/env.js`

## Implementacao recomendada

- Exigir `WEBHOOK_SECRET` no schema de env e remover `?? "your-secret-key"`.
- Validar `x-signature`, `x-request-id` e `data.id`; retornar 400 quando faltarem.
- Antes de atualizar voucher ou enviar eventos, verificar se o `payment_id` ja foi processado.
- Centralizar a confirmacao de pagamento aprovado em funcao `server-only`, para deixar idempotencia e logs em um unico lugar.
- Manter eventos de Meta/Google como nao bloqueantes, mas nunca duplica-los para o mesmo pagamento.

## Teste funcional minimo

- Enviar webhook sem headers obrigatorios e confirmar resposta 400.
- Enviar webhook com assinatura invalida e confirmar resposta 400.
- Enviar o mesmo pagamento aprovado duas vezes e confirmar que o voucher nao muda indevidamente e os eventos externos nao duplicam.

## Checklist

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] Documentacao atualizada quando necessario
