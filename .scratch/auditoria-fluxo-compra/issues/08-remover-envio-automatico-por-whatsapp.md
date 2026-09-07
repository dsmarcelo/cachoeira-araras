# 08: Remover o envio automático por WhatsApp

**What to build:** Confirmar pagamentos sem enviar mensagens automáticas por Twilio ou WhatsApp, direcionando o cliente para "Meus Vouchers" e para o download já disponível. Contatos manuais independentes do pagamento devem continuar funcionando.

**Blocked by:** None (can start immediately; the completed PR 2 already provides the customer-facing replacement).

**Status:** ready-for-agent

- [ ] Uma confirmação de pagamento atualiza o Voucher e registra a conversão sem chamar Twilio.
- [ ] Repetir a mesma notificação continua sendo idempotente e não duplica a conversão.
- [ ] Contratos usados somente pela mensagem, a dependência Twilio e suas configurações são removidos do código, exemplos e documentação.
- [ ] Instruções ao cliente apontam para "Meus Vouchers" e para o download, sem prometer uma mensagem automática.
- [ ] Links de contato manual com a cachoeira ou com o cliente permanecem disponíveis quando não dependem do envio automático.
