# 11: Limitar consultas públicas por Voucher Code

**What to build:** Impedir que um cliente anônimo enumere Voucher Codes por tentativas rápidas, preservando a consulta e as atualizações de status necessárias no retorno do pagamento, em "Meus Vouchers" e na portaria.

**Blocked by:** 10: Limitar a criação de checkouts.

**Status:** ready-for-agent

- [ ] A primeira consulta anônima por Voucher Code passa por uma operação que pode consumir o limitador compartilhado.
- [ ] Depois de uma consulta autorizada, o cliente acompanha o estado do mesmo Voucher sem permitir consultas ilimitadas de códigos diferentes.
- [ ] A consulta pública direta que permite testar códigos arbitrários deixa de contornar o limite.
- [ ] Retorno do pagamento, "Meus Vouchers", geração de imagem e validação na portaria continuam funcionando com seus níveis atuais de reatividade e acesso.
- [ ] Testes comprovam o bloqueio após o limite e a continuidade da consulta de um Voucher já autorizado.
