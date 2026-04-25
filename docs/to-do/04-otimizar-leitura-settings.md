# 04) Leitura otimizada de settings

## Prioridade

Media/baixa.

## Por que ainda faz sentido

- `getAllSettings()` centraliza o acesso, mas ainda faz uma consulta por chave.
- Settings sao usadas no formulario publico e na tabela de precos.
- Uma consulta unica no DAL reduz carga sem a complexidade de cache e invalidacao manual.

## Arquivos principais

- `src/lib/settings.ts`
- `src/server/api/routers/settings.ts`
- `src/app/admin/dashboard/configuracoes/actions.ts`

## Implementacao recomendada

- Criar um objeto de defaults tipado para todas as chaves de settings.
- Implementar `getAllSettings()` com `siteSetting.findMany()`.
- Mesclar os registros retornados com os defaults em memoria.
- Nao adicionar cache agora; considerar `unstable_cache`/tags apenas se houver evidencia de carga real no banco.
- Manter `setSetting()` invalidando a pagina de configuracoes como ja acontece hoje.

## Teste funcional minimo

- Abrir a home e confirmar que formulario e tabela de precos continuam com valores corretos.
- Abrir `/admin/dashboard/configuracoes` e confirmar que settings salvas e defaults aparecem.
- Alterar uma configuracao e confirmar que a pagina reflete o novo valor.

## Checklist

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] Documentacao atualizada quando necessario
