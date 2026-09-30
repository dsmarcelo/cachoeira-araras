# Ativação do pagamento no site (Payment Brick)

Todas as compras novas usam `/pagar/CODIGO`. Não há mais chave para voltar ao
Checkout Pro: o servidor não cria preferências. Compras Pro antigas continuam
sendo concluídas, consultadas, canceladas e estornadas normalmente.

## Credenciais (mesmo ambiente nos três lugares)

| Onde | Variável | Observação |
| --- | --- | --- |
| Next (Vercel / `.env`) | `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Pública: vai ao navegador. |
| Next (Vercel / `.env`) | `MERCADOPAGO_TOKEN` | Segredo, só servidor (webhook). |
| Convex | `MERCADOPAGO_TOKEN` | Cria e consulta cobranças. |

A public key e os dois tokens precisam ser da mesma aplicação e do mesmo
ambiente (teste ou produção). O sistema não consegue conferir isso sozinho:
credenciais de contas de teste também começam com `APP_USR-`. Nunca coloque o
token em variável `NEXT_PUBLIC_`. Sem a public key a página de pagamento avisa
que o pagamento está indisponível.

## Antes de ativar em produção

1. Validar em teste: Pix aprovado e vencido, cartão aprovado e recusado,
   parcelamento e 3DS (sucesso e falha), com o SDK real e contas de teste.
2. Conferir o mínimo de valor de Pix e cartão para o voucher de teste (R$ 0,01).
3. Testar no celular: QR e copiar Pix, teclado e leitor de tela.
4. Trocar as credenciais de teste pelas de produção nos três lugares acima e
   confirmar `SITE_URL` no Convex e a notificação (webhook) na aplicação.

## Monitoramento

- Falhas da página (criar cobrança, carregar o Brick, encerrar, cancelar,
  conferir) vão ao Sentry com etapa `payment.flow_step` e código do voucher;
  nunca dados de cartão, CVV ou credenciais.
- Falhas do servidor (cobrança incerta, operação que não conclui) ficam nos
  logs do Convex e em `paymentOperations` (`lastError`), com tentativas
  automáticas. Cobrança incerta bloqueia nova cobrança até ser resolvida.
- Vouchers Pro antigos: enquanto houver pendentes com preferência, não remover
  o suporte a Pro (reconciliação, cancelamento, estorno).
