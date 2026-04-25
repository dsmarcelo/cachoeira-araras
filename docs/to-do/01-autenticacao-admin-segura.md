# 01) Autenticacao admin segura

## O que sera modificado

- Substituir autenticacao por cookie simples/senha hardcoded por sessao segura.

## Arquivos principais

- `src/app/lib.ts`
- `src/app/admin/layout.tsx`
- `src/server/auth.ts`
- `src/app/_components/passwordLoginForm.tsx`
- `src/app/admin/_components/header.tsx`
- `scripts/generateAdminPasswordHash.ts`
- (se necessario) middleware/guards para `/admin/*`

## Implementacao (resumo)

- Remover senha fixa e usar segredo em variavel de ambiente (hash).
- Exigir sessao valida para acesso admin.
- Configurar cookie de sessao com `httpOnly`, `secure`, `sameSite`.
- Gerar `ADMIN_PASSWORD_HASH` com `pnpm admin:hash -- "<senha>"` para evitar problemas de quoting entre PowerShell e Bash.

## Melhora esperada

- Reduz risco de acesso indevido ao admin.
- Maior seguranca de producao e governanca de acesso.

## Checklist do item

- [x] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [x] `pnpm lint` OK
- [x] `pnpm type-check` OK
- [x] `pnpm build` OK
- [x] Documentacao atualizada quando necessario
