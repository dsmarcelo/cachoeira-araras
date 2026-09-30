# Pagamento de vouchers dentro do site

Status: implemented

Novas compras usam Mercado Pago Payment Brick em uma página do próprio site,
com resumo da compra, Pix e cartão de crédito. Conta Mercado Pago e Linha de
Crédito ficam desabilitadas porque redirecionam o comprador; boleto fica fora
do fluxo escolhido. A migração substitui Checkout Pro nas novas compras,
preservando a conclusão dos checkouts antigos até encerrarem.

O parcelamento preserva as condições oferecidas pela conta Mercado Pago,
com parcelas, juros e total apresentados antes da confirmação.

Cada Pix vence em 30 minutos. Outro código só pode ser gerado depois de
confirmado o encerramento da cobrança anterior. Para visitas no mesmo dia,
novos Pix são permitidos apenas antes das 16h30, com vencimento até 17h;
novos pagamentos por cartão são permitidos apenas antes das 17h.
Os horários seguem America/Sao_Paulo. O vencimento da cobrança Pix é distinto
da Expiry do Voucher e não altera a Visit Date.

Essa escolha mantém a experiência de compra no site e evita interromper
clientes em pagamento durante a transição. A manutenção temporária do
Checkout Pro existe apenas para concluir compras iniciadas anteriormente.

Referências: [conta Mercado Pago e Linha de Crédito](https://www.mercadopago.com/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/wallet-credits),
[prazo do Pix](https://www.mercadopago.com/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-with-pix)
e [parcelamento](https://www.mercadopago.com/developers/pt/docs/checkout-bricks/payment-brick/advanced-features/configure-installments).
