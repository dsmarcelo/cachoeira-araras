# 06) Cache/invalidacao para settings

## O que sera modificado

- Politica explicita para reduzir leituras repetidas de configuracao.

## Arquivos principais

- `src/lib/settings.ts`
- `src/server/api/routers/settings.ts`
- `src/app/admin/dashboard/configuracoes/actions.ts`

## Implementacao (resumo)

- Adicionar cache curto para `getAllSettings`.
- Invalidar cache apos update de configuracao.
- Padronizar uso de settings no front.

## Melhora esperada

- Menor latencia e menos carga no banco.
- Atualizacao consistente de regras operacionais.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
