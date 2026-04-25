# 03) Prisma singleton no cron

## Prioridade

Media.

## Por que ainda faz sentido

- `src/app/api/cron/route.ts` ainda cria `new PrismaClient()` localmente.
- O projeto ja possui `src/server/db.ts` para compartilhar o cliente Prisma.
- O cron hoje retorna apenas sucesso generico, sem dizer quantos registros foram alterados.

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

## Checklist

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] Documentacao atualizada quando necessario
