# 02) Endurecer autorizacao de tRPC

## O que sera modificado

- Procedures sensiveis deixarao de ser publicas.

## Arquivos principais

- `src/server/api/trpc.ts`
- `src/server/api/routers/voucher.ts`
- `src/server/api/routers/notification.ts`
- `src/server/api/routers/settings.ts`

## Implementacao (resumo)

- Migrar mutacoes sensiveis para `protectedProcedure`.
- Manter publicas apenas operacoes necessarias ao fluxo de compra.
- Padronizar retorno de erro com `TRPCError`.

## Melhora esperada

- Menor superficie de ataque.
- Menor chance de alteracao indevida de vouchers/settings.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
