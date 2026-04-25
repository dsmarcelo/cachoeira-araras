# 06) Consolidar Mercado Pago

## Prioridade

Baixa isoladamente; media se for feito junto com o webhook.

## Por que ainda faz sentido

- `src/server/api/routers/mercadopago.ts` ainda tem chamadas HTTP diretas para preference/payment.
- `src/app/api/webhook/route.ts` ja usa servico server-only para buscar pagamento.
- Consolidar ajuda manutencao, mas nao deve atrasar a correcao critica do webhook.

## Arquivos principais

- `src/server/api/routers/mercadopago.ts`
- `src/server/mercadopago.ts`
- `src/app/api/webhook/route.ts`

## Implementacao recomendada

- Manter procedures tRPC finas.
- Mover fetch e normalizacao de Mercado Pago para `src/server/mercadopago.ts`.
- Padronizar nomes como `getPreference`, `getPreferenceByExternalReference` e `getPayment`.
- Deixar o router responsavel por validacao de input e resposta tRPC, nao por detalhes da API externa.

## Teste funcional minimo

- Criar uma preference pelo fluxo de compra.
- Buscar uma preference no admin, se a tela usar essa query.
- Confirmar que o webhook continua conseguindo buscar pagamento aprovado.

## Checklist

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] Documentacao atualizada quando necessario
