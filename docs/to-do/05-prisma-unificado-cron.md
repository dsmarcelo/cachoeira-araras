# 05) Prisma unificado no cron

## O que sera modificado

- Cron deixara de instanciar `PrismaClient` localmente.

## Arquivos principais

- `src/app/api/cron/route.ts`
- `src/server/db.ts`

## Implementacao (resumo)

- Reutilizar cliente Prisma singleton do projeto.
- Registrar quantos vouchers foram atualizados/deletados em cada execucao.

## Melhora esperada

- Menos risco de conexoes excedentes.
- Operacao de cron mais previsivel.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
