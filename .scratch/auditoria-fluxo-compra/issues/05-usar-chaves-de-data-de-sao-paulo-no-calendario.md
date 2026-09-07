# 05: Usar chaves de data de São Paulo no calendário

**What to build:** Fazer o calendário da compra comparar Visit Dates como dias de São Paulo, sem depender do horário do dispositivo nem converter meia-noite local para outro dia em UTC.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Datas anteriores a hoje são bloqueadas pela chave de data de São Paulo.
- [ ] Dias fechados são comparados como `YYYY-MM-DD` e permanecem corretos em fusos a leste e a oeste de Greenwich.
- [ ] O calendário não depende da criação de uma data artificial cujo horário local imita São Paulo.
- [ ] Testes focados cobrem ao menos um fuso no qual a conversão para UTC mudaria o dia.
