# To-do — Otimizacoes Atuais

Este diretorio deve conter apenas planos ainda acionaveis. Os itens abaixo foram revisados contra o codigo atual.

## Ordem recomendada

1. [Fechar lacunas restantes do webhook Mercado Pago](./01-webhook-robusto-idempotente.md)
2. [Corrigir listeners e efeitos frageis no front](./05-corrigir-listeners-effects-front.md)
3. [Consolidar Mercado Pago](./06-consolidar-mercado-pago.md)

## Itens removidos do plano ativo

- Autenticacao admin segura: ja implementada.
- Endurecimento geral de tRPC: estrutura de guards ja existe e esta aplicada nos routers sensiveis.
- Cache manual de settings: substituido por uma consulta unica no DAL.
- Paginacao e filtros no servidor para telas admin: `findAdminPage`, filtros e resumos especificos ja substituem o antigo carregamento geral nas telas revisadas.
- Prisma singleton no cron: `src/app/api/cron/route.ts` ja usa `db` e retorna contadores.
- Leitura otimizada de settings: `getAllSettings()` ja usa `findMany()` e merge com defaults.
- Revisao ampla de imagens/LCP: so reabrir com medicao real de problema.
- Gate de release: `type-check` ja existe; CI pode ser criado futuramente, mas nao e prioridade de otimizacao.
