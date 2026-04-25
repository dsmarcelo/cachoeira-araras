# 05) Corrigir listeners e efeitos frageis no front

## Prioridade

Baixa, mas vale fazer quando tocar nessas telas.

## Por que ainda faz sentido

- `src/app/admin/tabela/voucher-table.tsx` ainda usa `window.onresize` fora de `useEffect`.
- `src/app/_components/voucher-form.tsx` tem efeito dependente de `settingsQuery`, o que pode causar reexecucoes desnecessarias.
- O ajuste reduz bugs pequenos de UI sem mudar regra de negocio.

## Arquivos principais

- `src/app/admin/tabela/voucher-table.tsx`
- `src/app/_components/voucher-form.tsx`
- `src/lib/utils.ts` ou um hook reutilizavel, somente se a extracao reduzir duplicacao real.

## Implementacao recomendada

- Substituir `window.onresize` por `addEventListener` dentro de `useEffect` com cleanup.
- Mover hook de largura da janela para fora do componente ou reaproveitar utilitario existente.
- Ajustar dependencias do efeito do formulario para executar apenas quando o fluxo de pagamento/referrer precisar.
- Preservar textos de UI em pt-BR e manter a mudanca pequena.

## Teste funcional minimo

- Abrir `/admin/tabela`, redimensionar a janela e confirmar que colunas aparecem/somem corretamente.
- Abrir a home com voucher pendente em cookie e confirmar que o link de pagamento ainda e recuperado.
- Voltar para a aba do navegador e confirmar que a checagem de pagamento ainda roda quando necessario.

## Checklist

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] Documentacao atualizada quando necessario
