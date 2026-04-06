# 03 — Mapa de Rotas e Páginas

## Rotas públicas (cliente)

- `/` — home com carrossel, informações e módulo de compra.
- `/galeria` — galeria de imagens.
- `/pagamento` — página de retorno pós-checkout (interpreta status e parâmetros).
- `/pagamento/aprovado` — página de confirmação de pagamento aprovado.
- `/voucher` — página de exibição do voucher com base em `code` e `pid` na query.
- `/comprar` — redireciona para `/` (rota legada).

## Rotas admin

- `/admin` — validação de vouchers + painel de vouchers do dia.
- `/admin/dashboard` — visão analítica/operacional do dia.
- `/admin/dashboard/configuracoes` — gerenciamento de settings do site.
- `/admin/dashboard/vendas` — área de vendas.
- `/admin/dashboard/vouchers` — visão de vouchers.
- `/admin/dashboard/referencias` — dados de referência/referrer.
- `/admin/tabela` — tabela detalhada de vouchers.
- `/admin/hoje` — visão focada em hoje.

## API Routes

- `/api/trpc/[trpc]` — endpoint central do tRPC.
- `/api/webhook` — webhook Mercado Pago (validação assinatura + atualização voucher).
- `/api/cron` — rotinas de expiração/limpeza de vouchers (protegida por bearer token).
- `/api/auth/[...nextauth]` — NextAuth handler.
- `/api/pagamento/aprovado` — endpoint simples para validar params de callback.

## Rotas utilitárias/teste

- `/(client)/test__`
- `/(client)/tests_iE72e7789D3`
- `/image-test`
- `/qr`

Sugestão: manter documentadas, mas considerar remover/ocultar em produção se não forem necessárias para operação.
