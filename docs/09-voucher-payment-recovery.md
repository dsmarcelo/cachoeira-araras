# Recuperação de pagamentos dos vouchers

Ao retornar do checkout ou abrir o voucher, o servidor consulta a preferência e o pagamento no Mercado Pago. Um pagamento aprovado, vinculado ao código do voucher e com valor/moeda compatíveis, pode confirmar um voucher pendente mesmo sem webhook e mesmo quando já há `payment_id` salvo.

## Decisões

- A mesma confirmação atômica atende webhook e recuperação nas telas. A atualização compara o status e o pagamento previamente lidos; apenas a transição vencedora solicita eventos de conversão.
- O servidor consulta pelo pagamento conhecido; quando necessário, pesquisa pagamentos aprovados por `external_reference`. A busca é restrita ao código e aos dez resultados mais recentes. Múltiplas aprovações são registradas para análise.
- `expires_at` é a data da visita (pode estar salva à meia-noite de Brasília): o voucher permanece confirmável durante todo esse dia em `America/Sao_Paulo` e vence só na virada para o dia seguinte. A confirmação e o cron (`voucher-maintenance.ts`) usam essa mesma regra (`voucher-expiry.ts`).
- Vouchers utilizados, expirados e excluídos não são reativados automaticamente. Estornos e chargebacks não fazem parte desta mudança.
- Nas listas, somente os registros da página são reconciliados. As listas de hoje usam dez registros por página; a tabela do dashboard só consulta vouchers quando sua aba está aberta. Os totais usam agregações no PostgreSQL, sem reconciliar registros fora da página.
- O limite de três reconciliações simultâneas e o intervalo de trinta segundos para listas são por instância do servidor, com cache limitado a mil entradas. Erros permitem nova tentativa após cinco segundos. O retorno do cliente, a abertura dos detalhes no admin e a consulta por código solicitam uma consulta fresca, para não reutilizar um resultado anterior ao pagamento. Não há migração de schema.
- As chamadas ao Mercado Pago usam `no-store` e timeout de oito segundos. Falhas de API preservam os dados locais e geram aviso na interface. Links pelo código curto exigem pagamento vinculado; não expõem detalhes pessoais quando esse vínculo não pode ser verificado.
- Após a reconciliação, a página relê apenas seus IDs em uma consulta ao banco, preservando resgates e exclusões concorrentes. Se um voucher deixar de corresponder ao filtro de pendentes, ele sai da página sem iniciar uma varredura das páginas seguintes.
- A função de conversão foi compartilhada com o webhook. Ela mantém a conversão de tipo já existente do payload recebido da API para `PaymentResponse`; essa tipagem não autoriza a confirmação, que valida vínculo, valor, moeda e status separadamente.

## Validação

- `pnpm install --frozen-lockfile`: dependências restauradas com autorização; sem alteração no lockfile.
- `pnpm test:payment-sync`: 18 testes passaram, incluindo ausência de webhook, pagamento previamente salvo, concorrência, vínculo/valor/moeda incorretos, falhas parciais, limite de chamadas e IDs da página.
- `pnpm test:webhook`: 22 testes passaram.
- `pnpm type-check`: passou após regenerar os tipos das rotas antigas em `.next`.
- ESLint dos arquivos TypeScript alterados: sem erros; aviso existente de incompatibilidade do React Compiler com `useReactTable`.
- `git diff --check`: passou.
- Checagens HTTP locais: `/voucher?code=invalid` e `/pagamento` sem parâmetros renderizam a mensagem de link inválido com sucesso.
- Execução ampliada dos testes de compra: três testes de `voucher-purchase-intake.test.ts` falham porque a data fixa de visita, `2026-05-10`, está no passado. Esses testes não foram alterados.

**not verified:** fluxo completo com Mercado Pago e banco de dados, navegação autenticada no admin, consultas agregadas em PostgreSQL real e layout em navegador. O ambiente não possui configuração completa para execução normal: `URL` e `CRON_SECRET`; a validação de produção também exige `NEXTAUTH_SECRET` e `ADMIN_PASSWORD_HASH`. `SKIP_ENV_VALIDATION=1` foi usado apenas para regeneração dos tipos e checagens locais de links inválidos, sem pagamentos ou consultas ao banco.

## QA manual

1. Em ambiente de testes autorizado, iniciar uma compra, aprovar o pagamento e simular a ausência do webhook, mantendo o voucher pendente.
2. Retornar para `/pagamento` e conferir que o banco e o voucher exibido passam para válido. Repetir com `payment_id` já registrado antes da aprovação.
3. Abrir o link `/voucher?code=...&pid=...` e o link por preferência em `/pagamento/aprovado`; conferir a mesma recuperação. Voltar à aba da compra e conferir a recuperação pelo cookie.
4. No admin, abrir a tabela com pelo menos duas páginas. Conferir nos registros de chamadas que apenas os vouchers da página atual são consultados. Abrir outra página e os detalhes de um voucher; conferir os respectivos IDs.
5. Na lista de hoje, testar paginação de administrador e funcionário. No dashboard, confirmar que a aba de resumo não dispara consultas de pagamentos de vouchers ocultos.
6. Filtrar pendentes, aprovar um deles e recarregar: ele deve sair do filtro e os totais devem atualizar, sem sincronizar automaticamente páginas seguintes.
7. Simular indisponibilidade da API: os demais vouchers continuam acessíveis, há aviso e opção de tentar novamente. Usar um voucher e recarregá-lo para confirmar que ele permanece utilizado.
8. Comparar totais e agrupamentos diários das telas de resumo com os dados do ambiente de testes.

## Arquivos alterados/criados

- `package.json`
- `src/app/(client)/pagamento/aprovado/page.tsx`
- `src/app/(client)/pagamento/page.tsx`
- `src/app/(client)/voucher/page.tsx`
- `src/app/_components/validate-voucher.tsx`
- `src/app/_components/voucher-created-card.tsx`
- `src/app/_components/voucher-form.tsx`
- `src/app/admin/_components/employee-today-vouchers.tsx`
- `src/app/admin/_components/today-vouchers.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/dashboard/vouchers/page.tsx`
- `src/app/admin/employee-voucher-info-card.tsx`
- `src/app/admin/tabela/data-table.tsx`
- `src/app/admin/tabela/voucher-table.tsx`
- `src/app/admin/voucher-info-card.tsx`
- `src/app/api/webhook/route.ts`
- `src/lib/voucher/server-utils.ts`
- `src/server/api/routers/voucher.ts`
- `src/server/mercadopago.ts`
- `src/server/voucher.ts`
- `src/app/_components/customer-voucher.tsx`
- `src/app/_components/refresh-voucher-button.tsx`
- `src/app/admin/_components/voucher-page-controls.tsx`
- `src/hooks/use-debounced-value.ts`
- `src/hooks/use-vouchers.ts`
- `src/server/load-customer-voucher.ts`
- `src/server/payment-conversion-events.ts`
- `src/server/voucher-payment-confirmation.test.ts`
- `src/server/voucher-payment-confirmation.ts`
- `src/server/voucher-payment-sync-core.ts`
- `src/server/voucher-payment-sync.test.ts`
- `src/server/voucher-payment-sync.ts`
- `src/server/voucher-payment-test-fixtures.ts`
- `docs/09-voucher-payment-recovery.md`
