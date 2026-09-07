# 12: Gerar Voucher Codes maiores e sem caracteres ambíguos

**What to build:** Emitir novos Voucher Codes de seis caracteres, usando um alfabeto Crockford sem caracteres fáceis de confundir e uma seleção uniforme, sem invalidar códigos de quatro caracteres já entregues aos clientes.

**Blocked by:** 11: Limitar consultas públicas por Voucher Code.

**Status:** ready-for-agent

- [ ] Toda nova compra normal ou de teste recebe um Voucher Code de seis caracteres no novo alfabeto.
- [ ] A geração não usa módulo enviesado e mantém o retry existente para colisões.
- [ ] Voucher Codes antigos continuam aceitos em consulta, retorno de pagamento, imagem, admin e portaria por tempo indeterminado.
- [ ] Entradas do cliente toleram diferenças de caixa previstas pelo formato sem transformar caracteres ambíguos silenciosamente.
- [ ] Testes cobrem o alfabeto, o comprimento, a compatibilidade com códigos antigos e o retry de colisão.
