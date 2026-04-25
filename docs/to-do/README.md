# To-do — Otimizacoes Atuais

Este diretorio separa os itens que ainda compensam aplicar, de acordo com `docs/06-optimization-implementation-plan.md`.

## Ordem recomendada

1. [Webhook robusto e idempotente](./01-webhook-robusto-idempotente.md)
2. [Paginacao e filtros no servidor para telas admin](./02-paginacao-filtros-servidor-admin.md)
3. [Prisma singleton no cron](./03-prisma-unificado-cron.md)
4. [Leitura otimizada de settings](./04-otimizar-leitura-settings.md)
5. [Listeners e efeitos frageis no front](./05-corrigir-listeners-effects-front.md)
6. [Consolidar Mercado Pago](./06-consolidar-mercado-pago.md)

## Itens removidos do plano ativo

- Autenticacao admin segura: ja implementada.
- Endurecimento geral de tRPC: estrutura de guards ja existe e esta aplicada nos routers sensiveis.
- Cache manual de settings: substituido por uma consulta unica no DAL.
- Revisao ampla de imagens/LCP: so reabrir com medicao real de problema.
- Gate de release: `type-check` ja existe; CI pode ser criado futuramente, mas nao e prioridade de otimizacao.
