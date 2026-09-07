# 13: Executar a manutenção diária em lotes indexados

**What to build:** Manter a expiração e a limpeza diária funcionando quando a tabela de Vouchers crescer, consultando somente os registros relevantes e continuando o trabalho em lotes seguros.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A manutenção encontra Vouchers vencidos por índice e não coleta a tabela inteira.
- [ ] Quando um lote não conclui o trabalho, a continuação é agendada com cursor ou limite equivalente sem pular ou repetir efeitos.
- [ ] Vouchers elegíveis expiram ou são removidos segundo as regras atuais, enquanto Vouchers futuros e Redeemed permanecem inalterados.
- [ ] Os testes existentes continuam verdes e novos testes exercitam mais de um lote.
- [ ] Uma execução repetida produz o mesmo estado final e não acumula continuações desnecessárias.
