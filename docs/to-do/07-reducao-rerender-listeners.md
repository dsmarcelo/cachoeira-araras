# 07) Reducao de re-render e listeners frageis

## O que sera modificado

- Ajustes em componentes com risco de re-render e listeners globais.

## Arquivos principais

- `src/app/_components/voucher-form.tsx`
- `src/app/admin/tabela/voucher-table.tsx`

## Implementacao (resumo)

- Remover `window.onresize` global e usar `useEffect` com cleanup.
- Estabilizar dependencias de `useEffect` no formulario.
- Extrair hooks utilitarios reutilizaveis.

## Melhora esperada

- Menos bugs de UI e melhor fluidez.
- Comportamento mais previsivel em mobile/desktop.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
