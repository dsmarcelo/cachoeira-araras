# 06 — Plano Atual de Otimizações

Documento prático para implementação individual. Esta versão foi revisada contra a documentação e o código atual do app para manter apenas o que ainda compensa aplicar.

## Estado atual

- A autenticação admin segura já existe com NextAuth, senha via hash em variável de ambiente e cookie de sessão seguro em produção.
- A autorização tRPC já possui `protectedProcedure`, `staffProcedure` e `adminProcedure`; as operações sensíveis de voucher, pagamento admin e notificação já usam guards.
- O script `type-check` já existe no `package.json`.
- Os arquivos em `docs/to-do` espelham este plano atual em tarefas separadas por item.

---

## O que ainda compensa fazer

### 1) Webhook robusto e idempotente

**Prioridade:** alta.

**Por que ainda faz sentido**
- O webhook ainda tem fallback de segredo (`your-secret-key`).
- Headers e query params obrigatórios são lidos com `!`, o que transforma erro de entrada em erro 500.
- O fluxo ainda pode repetir efeitos colaterais em reentregas do Mercado Pago se o mesmo pagamento chegar mais de uma vez.

**Arquivos principais**
- `src/app/api/webhook/route.ts`
- `src/server/voucher.ts`
- `src/server/mercadopago.ts`

**Implementação recomendada**
- Remover fallback inseguro e exigir `WEBHOOK_SECRET` validado pelo schema de env.
- Validar `x-signature`, `x-request-id` e `data.id` com retorno 400 quando ausentes.
- Antes de atualizar voucher ou enviar eventos de conversão, verificar se `payment_id` já foi processado.
- Centralizar a atualização do voucher aprovado em função server-only para manter idempotência e logs em um único lugar.

**Ganho esperado**
- Menor risco de fraude, processamento duplicado e falhas silenciosas no fluxo de pagamento.

---

### 2) Paginação e filtros no servidor para telas admin

**Prioridade:** alta quando a base de vouchers crescer; média se o volume atual ainda for pequeno.

**Por que ainda faz sentido**
- `/admin/tabela`, `/admin/dashboard/vouchers` e `/admin/dashboard/vendas` ainda usam `api.voucher.findAll.useQuery()`.
- A tabela pagina no navegador depois de baixar todos os vouchers.

**Arquivos principais**
- `src/server/api/routers/voucher.ts`
- `src/app/admin/tabela/data-table.tsx`
- `src/app/admin/tabela/voucher-table.tsx`
- `src/app/admin/dashboard/vouchers/page.tsx`
- `src/app/admin/dashboard/vendas/page.tsx`

**Implementação recomendada**
- Criar query admin paginada com `take`, `cursor` ou `skip`, mais filtros de status, busca e período.
- Retornar `items`, `total`, `page`/`cursor` e `pageSize`.
- Adaptar a tabela para paginação, busca e filtros server-side.
- Manter `findAll` apenas se existir uso administrativo pequeno e claramente justificado; caso contrário, remover.

**Ganho esperado**
- Menor consumo de memória no navegador e melhor previsibilidade conforme o histórico de vendas cresce.

---

### 3) Reutilizar o Prisma singleton no cron

**Prioridade:** média.

**Por que ainda faz sentido**
- `src/app/api/cron/route.ts` ainda instancia `new PrismaClient()` diretamente.
- O projeto já possui `src/server/db.ts` para compartilhar o cliente Prisma.

**Arquivos principais**
- `src/app/api/cron/route.ts`
- `src/server/db.ts`

**Implementação recomendada**
- Trocar a instância local por `db`.
- Retornar no JSON do cron quantos vouchers foram expirados e quantos pendentes foram marcados com soft delete.
- Deixar erros importantes subirem para resposta 500; o cron deve falhar alto quando a manutenção automática não rodar.

**Ganho esperado**
- Menor risco de excesso de conexões e operação mais fácil de auditar.

---

### 4) Otimizar leitura de settings sem cache customizado

**Prioridade:** média/baixa.

**Por que ainda faz sentido**
- `getAllSettings()` centraliza o acesso, mas internamente faz uma consulta por chave.
- Como settings são usados no formulário público e na tabela de preços, reduzir consultas é mais simples e seguro do que criar cache com invalidação manual.

**Arquivos principais**
- `src/lib/settings.ts`
- `src/server/api/routers/settings.ts`
- `src/app/admin/dashboard/configuracoes/actions.ts`

**Implementação recomendada**
- Implementar `getAllSettings()` com uma única consulta `findMany`.
- Mesclar o resultado com defaults tipados em memória.
- Não adicionar cache agora; só considerar `unstable_cache`/tags se houver evidência de carga real no banco.

**Ganho esperado**
- Menos consultas por carregamento da home, sem aumentar complexidade de invalidação.

---

### 5) Corrigir listeners e efeitos frágeis no front

**Prioridade:** baixa, mas vale fazer quando tocar nessas telas.

**Por que ainda faz sentido**
- `src/app/admin/tabela/voucher-table.tsx` ainda usa `window.onresize` fora de `useEffect`.
- `src/app/_components/voucher-form.tsx` tem efeito dependente de `settingsQuery`, o que pode causar reexecuções desnecessárias.

**Arquivos principais**
- `src/app/admin/tabela/voucher-table.tsx`
- `src/app/_components/voucher-form.tsx`
- `src/lib/utils.ts` ou novo hook reutilizável, se a extração realmente reduzir duplicação.

**Implementação recomendada**
- Substituir `window.onresize` por `addEventListener` dentro de `useEffect` com cleanup.
- Mover hook de largura da janela para fora do componente ou reutilizar utilitário existente.
- Ajustar dependências do efeito do formulário para executar apenas quando o fluxo de pagamento/referrer precisar.

**Ganho esperado**
- UI mais previsível em resize, menos re-render desnecessário e menos risco de listener global sobrescrito.

---

### 6) Consolidar Mercado Pago quando mexer no webhook ou no admin

**Prioridade:** baixa isoladamente; média se for feito junto com o webhook.

**Por que ainda faz sentido**
- `src/server/api/routers/mercadopago.ts` ainda concentra chamadas HTTP diretas para preference/payment.
- `src/app/api/webhook/route.ts` já usa serviço server-only para buscar pagamento.
- A consolidação ajuda, mas não deve bloquear as correções críticas do webhook.

**Arquivos principais**
- `src/server/api/routers/mercadopago.ts`
- `src/server/mercadopago.ts`
- `src/app/api/webhook/route.ts`

**Implementação recomendada**
- Manter procedures tRPC finas.
- Mover fetch/normalização de Mercado Pago para `src/server/mercadopago.ts`.
- Padronizar nomes como `getPreference`, `getPreferenceByExternalReference` e `getPayment`.

**Ganho esperado**
- Menor duplicação e manutenção mais simples das integrações de pagamento.

---

## O que foi retirado do plano ativo

- **Autenticação admin segura:** já implementada com NextAuth, hashes por env e roles.
- **Endurecimento geral de tRPC:** a estrutura já existe e os principais routers sensíveis já usam `adminProcedure`/`staffProcedure`; manter apenas revisão pontual ao criar novas procedures.
- **Cache/invalidação manual de settings:** não compensa agora; uma query única no DAL resolve o maior problema com menos risco.
- **Revisão ampla de imagens/LCP:** `images.unoptimized` parece uma decisão consciente para evitar custos/requests de otimização na Vercel Free. Só reabrir se houver medição ruim de LCP.
- **Gate de release:** `type-check` já existe. Se criar CI no futuro, usar `pnpm lint`, `pnpm type-check` e `pnpm build`, mas isso não é uma otimização urgente do app.

---

## Ordem recomendada

1. Webhook robusto e idempotente.
2. Paginação/filtros server-side nas telas admin.
3. Prisma singleton no cron.
4. `getAllSettings()` com consulta única.
5. Listeners/effects frágeis no front.
6. Consolidação Mercado Pago, preferencialmente junto do webhook.

---

## Checklist por item

Para cada item aplicado:
- [ ] Mudança limitada aos arquivos do fluxo afetado
- [ ] Erros tratados na função e refletidos corretamente na UI quando houver UI envolvida
- [ ] Teste funcional mínimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] Documentação atualizada quando a estrutura mudar
