# 03: Remover código morto do fluxo público

**What to build:** Reduzir o fluxo público de compra ao comportamento que o cliente realmente usa, removendo a interface inalcançável e os campos antigos que sempre são enviados como zero, sem retirar recursos ainda usados pelo admin.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A rota antiga de compra preserva apenas o redirecionamento necessário e não contém interface inalcançável.
- [ ] A validação e a submissão públicas não incluem quantidades que o cliente não pode escolher.
- [ ] A compra pública de Voucher continua enviando somente os dados aceitos pelo Voucher Purchase Intake.
- [ ] A compra de teste e o Site Setting de piscina são mantidos se ainda tiverem consumidores administrativos; itens comprovadamente órfãos são removidos.
