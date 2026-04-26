# 02) Paginacao e filtros no servidor para telas admin

## Prioridade

Alta quando a base de vouchers crescer; media enquanto o volume atual for pequeno.

## Por que ainda faz sentido

- `/admin/tabela`, `/admin/dashboard/vouchers` e `/admin/dashboard/vendas` ainda usam `api.voucher.findAll.useQuery()`.
- A tabela pagina no client depois de baixar todos os vouchers.
- O custo cresce junto com o historico de vendas, mesmo quando o admin precisa ver apenas uma pagina.

## Arquivos principais

- `src/server/api/routers/voucher.ts`
- `src/app/admin/tabela/data-table.tsx`
- `src/app/admin/tabela/voucher-table.tsx`
- `src/app/admin/dashboard/vouchers/page.tsx`
- `src/app/admin/dashboard/vendas/page.tsx`

## Implementacao recomendada

- Criar query admin paginada com `take`, `cursor` ou `skip`.
- Aceitar filtros de status, busca por codigo/nome/telefone e periodo.
- Retornar `items`, `total`, `page` ou `cursor`, e `pageSize`.
- Adaptar a tabela para enviar filtros ao servidor e renderizar estado de loading/erro em pt-BR.
- Manter `findAll` apenas se existir uso pequeno e justificado; caso contrario, remover para evitar novos usos acidentais.

## Teste funcional minimo

- Abrir `/admin/tabela` e trocar paginas.
- Filtrar por status e confirmar que o total e os itens batem.
- Buscar por codigo conhecido e confirmar retorno correto.

## Checklist

- [x] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [x] `pnpm lint` OK
- [x] `pnpm type-check` OK
- [x] Documentacao atualizada quando necessario
