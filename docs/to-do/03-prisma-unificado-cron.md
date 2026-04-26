# 03) Prisma singleton no cron

## Prioridade

Media.

## Status

Aplicado.

## Por que fazia sentido

- `src/app/api/cron/route.ts` criava `new PrismaClient()` localmente.
- O projeto ja possui `src/server/db.ts` para compartilhar o cliente Prisma.
- O cron retornava apenas sucesso generico, sem dizer quantos registros foram alterados.

## Arquivos principais

- `src/app/api/cron/route.ts`
- `src/server/db.ts`

## Implementacao recomendada

- Trocar a instancia local por `db`.
- Fazer `updateExpiredVouchers()` e `deleteExpiredPendingVouchers()` retornarem os contadores do `updateMany`.
- Retornar JSON com quantos vouchers foram expirados e quantos pendentes receberam soft delete.
- Remover `try/catch` que apenas loga e engole erro; o cron deve responder 500 quando a manutencao falhar.

## Teste funcional minimo

- Chamar `/api/cron` sem token e confirmar 401.
- Chamar com `CRON_SECRET` valido e confirmar JSON com contadores.
- Confirmar que falhas no banco nao retornam sucesso falso.

Observacao: a chamada com `CRON_SECRET` valido altera vouchers vencidos. Executar apenas com banco local ou descartavel.

Validado sem mutacao: chamada sem token retornou 401 `Unauthorized`.

## Checklist

- [x] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [x] `pnpm lint` OK
- [x] `pnpm type-check` OK
- [x] Documentacao atualizada quando necessario
