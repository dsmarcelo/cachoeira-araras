# 09: Invalidar Voucher após reversão do pagamento

**What to build:** Impedir a entrada com um Voucher cujo pagamento foi estornado, cancelado ou sofreu chargeback. A situação deve aparecer corretamente para o cliente e para o admin sem apagar o histórico da compra.

**Blocked by:** None (can start immediately; the completed PR 2 already exposes status and image to the customer).

**Status:** ready-for-agent

- [ ] Uma notificação terminal negativa move todo Voucher ainda não Redeemed para um estado explícito e não resgatável de pagamento revertido.
- [ ] A portaria recusa o Voucher e "Meus Vouchers" não o apresenta como entrada válida nem disponibiliza uma nova imagem de Voucher válido.
- [ ] Um Voucher já Redeemed permanece terminal e ganha um aviso administrativo visível sobre a reversão posterior.
- [ ] Notificações repetidas continuam idempotentes e não apagam dados ou eventos anteriores.
- [ ] Testes cobrem estorno, chargeback e cancelamento antes e depois do resgate.
