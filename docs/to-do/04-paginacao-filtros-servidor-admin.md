# 04) Paginacao e filtros no servidor (admin)

## O que sera modificado

- Listagens admin deixarao de carregar tudo no client.

## Arquivos principais

- `src/server/api/routers/voucher.ts`
- `src/app/admin/dashboard/vouchers/page.tsx`
- `src/app/admin/tabela/data-table.tsx`
- `src/app/admin/tabela/voucher-table.tsx`

## Implementacao (resumo)

- Criar query paginada (`take/skip` ou cursor) com filtros (status, busca, periodo).
- Retornar total e pagina atual.
- Adaptar UI para paginacao server-side.

## Melhora esperada

- Escala melhor com crescimento de dados.
- Menor uso de memoria e CPU no navegador.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
