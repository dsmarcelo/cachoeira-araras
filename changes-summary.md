# Resumo das Alterações

## Integração de Pagamentos
- Adicionada camada unificada em `src/server/payments` com providers para Mercado Pago e Getnet (Link de Pagamento) baseada na documentação oficial da Getnet ([Getnet Link de Pagamento](https://developers.getnet.com.br/products-docs/b07ilzfwy21roh8ui801cvxz?doc=zza1tadlkht90bv85jl8ks59&from=)).
- Criado router `payments` em `src/server/api/routers/payments.ts` para expor mutações/queries genéricas (`create`, `status`).
- Atualizados os providers para expor resultados normalizados (`preferenceId`, `paymentLink`, `paymentId`).

## Persistência e Tipagem
- `prisma/schema.prisma`: inclusão de `payment_provider` e `payment_url` no modelo `Voucher`.
- Ajustes nos schemas e tipos em `src/lib/voucher/types.ts` e `src/types/voucher.ts` para refletir os novos campos.

## Formulários e UI
- `src/app/_components/voucher-form.tsx` e `voucher-form-test.tsx` agora consomem `api.payments.create`, armazenam `payment_url` e consultam `payments.status` para redirecionamento pós-pagamento.
- `src/app/_components/voucher-created-card.tsx` utiliza helper compartilhado para construir URLs de sucesso com base no provedor ativo.
- Novo helper `buildSuccessUrl` em `src/lib/payments/url.ts`.

## Configuração e Documentação
- `src/env.js`: adicionadas variáveis `GETNET_CLIENT_ID`, `GETNET_CLIENT_SECRET`, `GETNET_SELLER_ID`, `GETNET_BASE_URL` e validação para `PAYMENT_PLATFORM`.
- `README.md`: seção "Pagamentos" descrevendo configuração multi provedores e variáveis de ambiente necessárias.

## Observações
- Necessário executar `pnpm prisma migrate dev` para aplicar a alteração do schema Prisma.
- Webhook atual continua específico do Mercado Pago; próxima etapa é adicionar tratamento Getnet.
