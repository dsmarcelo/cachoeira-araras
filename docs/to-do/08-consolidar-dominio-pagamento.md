# 08) Consolidar dominio de pagamento

## O que sera modificado

- Remover duplicidade e padronizar nomenclatura/fluxo.

## Arquivos principais

- `src/server/api/routers/mercadopago.ts`
- `src/app/(client)/pagamento/page.tsx`
- `src/app/(client)/pagamento/aprovado/page.tsx`
- `src/app/(client)/voucher/page.tsx`
- `src/lib/mercadopago/*`

## Implementacao (resumo)

- Corrigir typo `getPrefence` e eliminar duplicacoes.
- Centralizar fetch e normalizacao de `payment/preference` em servico unico.

## Melhora esperada

- Menor custo de manutencao.
- Menos inconsistencias entre paginas de pagamento.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
