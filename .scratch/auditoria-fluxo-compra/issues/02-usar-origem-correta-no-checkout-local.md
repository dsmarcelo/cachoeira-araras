# 02: Usar a origem correta no checkout local

**What to build:** Tornar explícita e segura a configuração das URLs usadas pelo checkout e pelo webhook, mantendo a compra e o retorno na mesma origem durante testes locais para que o histórico do navegador continue disponível.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A configuração do webhook aceita somente uma URL base sem caminho e falha com uma mensagem clara quando recebe um valor inválido.
- [ ] O ambiente de desenvolvimento usa a URL base correta, sem depender do descarte silencioso de um caminho configurado.
- [ ] O fluxo local documentado mantém compra e retorno na mesma origem, incluindo o uso de túnel quando necessário.
- [ ] O retorno em uma origem sem histórico local continua usando a recuperação já existente, sem quebrar a tela de pagamento.
