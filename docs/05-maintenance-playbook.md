# 05 — Playbook de Manutenção (Solo Dev)

## Rotina de desenvolvimento local

1. Instalar dependências: `pnpm install`
2. Subir ambiente: `pnpm dev`
3. Verificações antes de subir mudanças:
   - `npm run lint`
   - `npm run type-check` (ou equivalente local com `tsc --noEmit` se o script não existir)
   - `npm run build`

## Tarefas comuns e onde mexer

## 1) Alterar preço e disponibilidade de venda

- Primeiro tente em `/admin/dashboard/configuracoes`.
- Se precisar novo parâmetro, adicionar chave em:
  - tipo de chave em `src/lib/settings.ts`;
  - formulário de configurações em `src/app/admin/dashboard/configuracoes/page.tsx`.

## 2) Ajustar regras do formulário de compra

- Arquivo principal: `src/app/_components/voucher-form.tsx`.
- Utilitários de cálculo/formatação em `src/lib/utils/utils.ts` e `src/lib/voucher/*`.

## 3) Alterar comportamento de pagamento

- Criação de preferência: `src/server/api/routers/mercadopago.ts`.
- Retorno e exibição para usuário: `src/app/(client)/pagamento/*` e `src/app/(client)/voucher/page.tsx`.
- Confirmação assíncrona oficial: `src/app/api/webhook/route.ts`.

## 4) Ajustar vencimento e limpeza automática

- Job: `src/app/api/cron/route.ts`.
- Token de proteção: `CRON_SECRET`.

## Checklist para mudanças seguras

Antes de merge/deploy:

- [ ] Fluxo de compra completo testado (criação -> checkout -> retorno).
- [ ] Webhook funcionando no ambiente alvo (assinatura válida).
- [ ] Admin consegue validar voucher e consumi-lo.
- [ ] Cron de expiração executando com autorização correta.
- [ ] Lint/build verdes.
- [ ] Se a mudança afetar pagamento, conferir eventos/spans no Sentry com `payment.flow_step`.

## Variáveis de ambiente críticas

- Banco e app: `DATABASE_URL`, `URL`.
- Auth e sessão: `NEXTAUTH_SECRET`; a URL base vem de `URL` quando `NEXTAUTH_URL` nao estiver definida.
- Pagamento: `MERCADOPAGO_TOKEN`, `URL`, `WEBHOOK_URL`.
- Manutenção: `CRON_SECRET`.
- Tracking opcional: Meta/Google Ads.
- Monitoramento opcional: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`.
- Upload de sourcemaps Sentry no build/CI: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

## Riscos conhecidos para futuras mudanças

- Alterar formato de `code` sem revisar validações quebra busca/consulta.
- Alterar status sem alinhar webhook/admin/cron pode criar inconsistência.
- Mudar estrutura de `SiteSetting` exige cuidado com defaults no DAL.

## Sugestões de evolução incremental

- Consolidar páginas de teste e remover rotas não usadas em produção.
- Criar script oficial `type-check` no `package.json`.
- Adicionar testes e2e mínimos para fluxo de compra e validação de voucher.
- Padronizar nomenclatura (pt/en) para facilitar manutenção de longo prazo.
