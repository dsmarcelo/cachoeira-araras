# 10: Limitar a criação de checkouts

**What to build:** Proteger o Voucher Purchase Intake contra criação automatizada ou acidental de preferências, com limites por telefone, um limite global mais folgado e um teto para Vouchers Pending não expirados.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Chamadas dentro dos limites continuam criando a preferência e o Voucher Pending normalmente.
- [ ] Exceder o limite por telefone, o limite global ou o teto de pendências impede a criação de uma nova preferência no Mercado Pago.
- [ ] O formulário apresenta uma mensagem clara e acionável quando o cliente precisa aguardar ou retomar uma compra pendente.
- [ ] Limites concorrentes usam o componente de rate limiting do Convex, sem contadores sujeitos a corrida.
- [ ] Testes cobrem cada limite e comprovam que uma tentativa recusada não persiste um Voucher parcial.
