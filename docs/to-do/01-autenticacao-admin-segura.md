# 01) Autenticacao admin segura

## O que sera modificado

- Substituir autenticacao por cookie simples/senha hardcoded por sessao segura.

## Arquivos principais

- `src/app/lib.ts`
- `src/app/admin/layout.tsx`
- `src/server/auth.ts`
- (se necessario) middleware/guards para `/admin/*`

## Implementacao (resumo)

- Remover senha fixa e usar segredo em variavel de ambiente (hash).
- Exigir sessao valida para acesso admin.
- Configurar cookie de sessao com `httpOnly`, `secure`, `sameSite`.

## Melhora esperada

- Reduz risco de acesso indevido ao admin.
- Maior seguranca de producao e governanca de acesso.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
