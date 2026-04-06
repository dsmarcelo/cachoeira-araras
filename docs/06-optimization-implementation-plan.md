# 06 — Plano de Implementação das Otimizações

Documento prático para implementação individual. Cada item descreve **o que mudar**, **onde mudar** e **qual ganho esperado**.

---

## Ordem de execução recomendada

1. Segurança e integridade (itens 1–3)
2. Escalabilidade backend (itens 4–6)
3. Performance frontend e organização (itens 7–9)
4. Qualidade de release/produção (item 10)

---

## 1) Autenticação admin segura

**O que será modificado**
- Substituir autenticação por cookie simples/senha hardcoded por sessão segura.

**Arquivos principais**
- `src/app/lib.ts`
- `src/app/admin/layout.tsx`
- `src/server/auth.ts`
- (se necessário) middleware/guards para `/admin/*`

**Implementação (resumo)**
- Remover senha fixa e usar segredo em variável de ambiente (hash).
- Exigir sessão válida para acesso admin.
- Configurar cookie de sessão com `httpOnly`, `secure`, `sameSite`.

**Melhora esperada**
- Reduz risco de acesso indevido ao admin.
- Maior segurança de produção e governança de acesso.

---

## 2) Endurecer autorização de tRPC

**O que será modificado**
- Procedures sensíveis deixarão de ser públicas.

**Arquivos principais**
- `src/server/api/trpc.ts`
- `src/server/api/routers/voucher.ts`
- `src/server/api/routers/notification.ts`
- `src/server/api/routers/settings.ts`

**Implementação (resumo)**
- Migrar mutações sensíveis para `protectedProcedure`.
- Manter públicas apenas operações necessárias ao fluxo de compra.
- Padronizar retorno de erro com `TRPCError`.

**Melhora esperada**
- Menor superfície de ataque.
- Menor chance de alteração indevida de vouchers/settings.

---

## 3) Webhook robusto e idempotente

**O que será modificado**
- Validação de webhook com regras estritas e sem fallback inseguro.

**Arquivos principais**
- `src/app/api/webhook/route.ts`
- `src/server/api/routers/voucher.ts` (suporte a idempotência se necessário)

**Implementação (resumo)**
- Remover fallback de segredo (`your-secret-key`).
- Validar obrigatoriedade de headers e parâmetros.
- Garantir processamento idempotente por `payment_id`/`code`.
- Logar eventos e falhas de forma rastreável.

**Melhora esperada**
- Menor risco de fraude/processamento duplo.
- Fluxo de pagamento mais estável em produção.

---

## 4) Paginação e filtros no servidor (admin)

**O que será modificado**
- Listagens admin deixarão de carregar tudo no client.

**Arquivos principais**
- `src/server/api/routers/voucher.ts`
- `src/app/admin/dashboard/vouchers/page.tsx`
- `src/app/admin/tabela/data-table.tsx`
- `src/app/admin/tabela/voucher-table.tsx`

**Implementação (resumo)**
- Criar query paginada (`take/skip` ou cursor) com filtros (status, busca, período).
- Retornar total e página atual.
- Adaptar UI para paginação server-side.

**Melhora esperada**
- Escala melhor com crescimento de dados.
- Menor uso de memória e CPU no navegador.

---

## 5) Prisma unificado no cron

**O que será modificado**
- Cron deixará de instanciar `PrismaClient` localmente.

**Arquivos principais**
- `src/app/api/cron/route.ts`
- `src/server/db.ts`

**Implementação (resumo)**
- Reutilizar cliente Prisma singleton do projeto.
- Registrar quantos vouchers foram atualizados/deletados em cada execução.

**Melhora esperada**
- Menos risco de conexões excedentes.
- Operação de cron mais previsível.

---

## 6) Cache/invalidação para settings

**O que será modificado**
- Política explícita para reduzir leituras repetidas de configuração.

**Arquivos principais**
- `src/lib/settings.ts`
- `src/server/api/routers/settings.ts`
- `src/app/admin/dashboard/configuracoes/actions.ts`

**Implementação (resumo)**
- Adicionar cache curto para `getAllSettings`.
- Invalidar cache após update de configuração.
- Padronizar uso de settings no front.

**Melhora esperada**
- Menor latência e menos carga no banco.
- Atualização consistente de regras operacionais.

---

## 7) Redução de re-render e listeners frágeis

**O que será modificado**
- Ajustes em componentes com risco de re-render e listeners globais.

**Arquivos principais**
- `src/app/_components/voucher-form.tsx`
- `src/app/admin/tabela/voucher-table.tsx`

**Implementação (resumo)**
- Remover `window.onresize` global e usar `useEffect` com cleanup.
- Estabilizar dependências de `useEffect` no formulário.
- Extrair hooks utilitários reutilizáveis.

**Melhora esperada**
- Menos bugs de UI e melhor fluidez.
- Comportamento mais previsível em mobile/desktop.

---

## 8) Consolidar domínio de pagamento

**O que será modificado**
- Remover duplicidade e padronizar nomenclatura/fluxo.

**Arquivos principais**
- `src/server/api/routers/mercadopago.ts`
- `src/app/(client)/pagamento/page.tsx`
- `src/app/(client)/pagamento/aprovado/page.tsx`
- `src/app/(client)/voucher/page.tsx`
- `src/lib/mercadopago/*`

**Implementação (resumo)**
- Corrigir typo `getPrefence` e eliminar duplicações.
- Centralizar fetch e normalização de `payment/preference` em serviço único.

**Melhora esperada**
- Menor custo de manutenção.
- Menos inconsistências entre páginas de pagamento.

---

## 9) Estratégia de imagens e LCP

**O que será modificado**
- Revisar uso de `images.unoptimized` global e pipeline de assets.

**Arquivos principais**
- `next.config.js`
- `src/app/_components/image_carousel.tsx`
- `src/app/_components/swiper-carousel/mini-image-carousel.tsx`
- `public/images/*`

**Implementação (resumo)**
- Avaliar otimização seletiva de imagens.
- Padronizar dimensões, compressão e formatos modernos.
- Manter prioridade apenas para imagens críticas.

**Melhora esperada**
- Melhor LCP e experiência inicial do usuário.
- Uso de banda mais eficiente.

---

## 10) Gate de qualidade para release

**O que será modificado**
- Pipeline de validação para deploy previsível.

**Arquivos principais**
- `package.json`
- (se existir) workflow de CI
- `docs/05-maintenance-playbook.md`

**Implementação (resumo)**
- Criar script `type-check`.
- Exigir `lint`, `type-check` e `build` antes de merge/deploy.
- Incluir checklist de variáveis críticas de produção.

**Melhora esperada**
- Menos regressão em produção.
- Processo de manutenção mais confiável para solo dev.

---

## Checklist de implementação por item

Para cada item acima, confirmar:
- [ ] Mudança aplicada nos arquivos listados
- [ ] Teste funcional mínimo do fluxo afetado
- [ ] `npm run lint` OK
- [ ] `npm run type-check` OK
- [ ] `npm run build` OK
- [ ] Documentação atualizada quando necessário
