# 03) Webhook robusto e idempotente

## O que sera modificado

- Validacao de webhook com regras estritas e sem fallback inseguro.

## Arquivos principais

- `src/app/api/webhook/route.ts`
- `src/server/api/routers/voucher.ts` (suporte a idempotencia se necessario)

## Implementacao (resumo)

- Remover fallback de segredo (`your-secret-key`).
- Validar obrigatoriedade de headers e parametros.
- Garantir processamento idempotente por `payment_id`/`code`.
- Logar eventos e falhas de forma rastreavel.

## Melhora esperada

- Menor risco de fraude/processamento duplo.
- Fluxo de pagamento mais estavel em producao.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
