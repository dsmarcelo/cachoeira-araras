# 02 — Arquitetura e stack técnica

## Stack principal

- Next.js App Router, React e TypeScript na aplicação web.
- Convex para dados, funções reativas e autenticação com Better Auth.
- Mercado Pago para checkout e pagamentos; Twilio para notificações opcionais.
- Tailwind CSS e Radix UI na interface; Sentry para observabilidade.

## Limites da arquitetura

- O navegador acessa queries, mutations e actions do Convex diretamente.
- Rotas HTTP do Next.js ficam restritas a adaptadores, como webhook e proxy de autenticação.
- Integrações externas e regras transacionais vivem no backend; a UI apenas orquestra estado e apresentação.
- O tRPC foi removido deliberadamente; a decisão está em [`adr/0001-replace-trpc-with-direct-convex-access.md`](./adr/0001-replace-trpc-with-direct-convex-access.md).

## Estado da persistência

Nesta branch, os fluxos do app leem e escrevem no Convex. Isso não significa que os dados PostgreSQL de produção já foram importados: somente o banco de desenvolvimento/teste passou pelo ensaio completo.

Prisma não participa do tráfego normal do app, mas continua como ponte de migração e ferramenta de teste. O schema legado, Prisma Client, CLI, `DATABASE_URL` e o importador devem permanecer funcionais até o corte de produção ser validado e o período de rollback terminar.

O procedimento e os critérios para remover essa ponte estão em [`operations/postgres-to-convex-cutover.md`](./operations/postgres-to-convex-cutover.md).
