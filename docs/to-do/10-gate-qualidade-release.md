# 10) Gate de qualidade para release

## O que sera modificado

- Pipeline de validacao para deploy previsivel.

## Arquivos principais

- `package.json`
- (se existir) workflow de CI
- `docs/05-maintenance-playbook.md`

## Implementacao (resumo)

- Criar script `type-check`.
- Exigir `lint`, `type-check` e `build` antes de merge/deploy.
- Incluir checklist de variaveis criticas de producao.

## Melhora esperada

- Menos regressao em producao.
- Processo de manutencao mais confiavel para solo dev.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
