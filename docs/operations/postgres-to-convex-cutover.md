# Corte de PostgreSQL para Convex

## Estado atual

A aplicação desta branch usa Convex, mas a importação do PostgreSQL de produção **não foi executada**. O ensaio em desenvolvimento importou 97 vouchers.

Prisma é uma ponte temporária obrigatória: lê o banco legado no corte e também sustenta o teste E2E de pagamentos. Não remova `prisma/`, `@prisma/client`, `prisma`, `DATABASE_URL`, os scripts `db:*`, `postinstall` ou `scripts/import-postgres-to-convex/` antes da conclusão deste runbook.

## Garantias do importador

- Lê Vouchers e Referrers (Site Settings não são importados); não escreve no PostgreSQL.
- Normaliza status, converte reais em centavos, deriva data/expiração e incorpora o referrer.
- Insere por código do voucher e não altera registros já existentes no Convex.
- Falha diante de status ou valores desconhecidos em vez de adivinhar.
- Alternativa em lote: `pnpm export:postgres-to-convex` gera `.import-data/vouchers.jsonl` para o `convex import` (veja o README); não passa pelo bloqueio `dev:` nem ignora códigos já existentes, então confira o alvo e use `--replace` ou `--append` conscientemente.
- Atualmente recusa qualquer `CONVEX_DEPLOYMENT` que não comece com `dev:`; portanto não pode atingir produção sem uma mudança deliberada e revisada.

## Repetir o ensaio

1. Use uma cópia recente do PostgreSQL e um deployment Convex de desenvolvimento vazio.
2. Configure `DATABASE_URL` e `CONVEX_DEPLOYMENT=dev:...` em `.env.local`.
3. Rode `pnpm test:import` e depois `pnpm import:postgres-to-convex`.
4. Resolva explicitamente toda linha recusada; não substitua valores por defaults silenciosos.
5. Compare contagens e amostras dos dois bancos; valide status, preços, datas e referrers.
6. Rode novamente: o resultado esperado é zero inserções e todas as linhas como `unchanged`.

## Corte de produção

1. Faça backup, registre contagens de origem e defina uma janela sem novas escritas no PostgreSQL.
2. Garanta que schema e mutations internas de importação estejam no deployment Convex de produção.
3. Altere o bloqueio `dev:` para exigir alvo de produção e confirmação explícitos; revise e repita os testes.
4. Use credenciais PostgreSQL somente-leitura, execute uma vez e preserve o relatório completo.
5. Reconcilie colisões: um código já existente no Convex é ignorado, não atualizada.
6. Compare contagens e amostras, então direcione a aplicação para Convex e monitore pagamentos e resgates.
7. Mantenha o PostgreSQL somente-leitura durante o período de rollback.

Remova a ponte Prisma somente após validação formal do corte, término do rollback e substituição do teste E2E que ainda usa Prisma.
