# 06: Validar a janela de Visit Date igual ao servidor

**What to build:** Fazer o formulário aplicar a mesma janela de Visit Date usada pelo Voucher Purchase Intake, rejeitando no cliente dias passados e dias posteriores ao limite configurado nos Site Settings.

**Blocked by:** 05: Usar chaves de data de São Paulo no calendário.

**Status:** ready-for-agent

- [ ] O limite mínimo da validação é hoje em São Paulo, sem aceitar dias no passado.
- [ ] O limite máximo vem do Site Setting usado pelo servidor, sem uma segunda configuração pública divergente.
- [ ] Calendário e validação do formulário concordam nos dois extremos da janela permitida.
- [ ] O servidor continua sendo a autoridade e rejeita uma submissão manipulada fora da janela.
