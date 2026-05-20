# Checkout Pro: como testar com contas de teste (Mercado Pago)

Este guia cobre **somente Checkout Pro** e descreve o fluxo prático para validar pagamentos usando contas de teste no Mercado Pago.

## 1) Pré-requisitos

- Ter uma conta Mercado Pago real (conta principal do integrador/vendedor).
- Ter uma aplicação criada em **Suas integrações**.
- Ter acesso às **credenciais de teste** da aplicação.
- Definir o país da operação (ex.: Brasil = `MLB`).

## 2) Criar contas de teste

No painel do Mercado Pago:

1. Acesse **Suas integrações** e abra sua aplicação.
2. Entre em **Contas de teste**.
3. Clique em **Criar conta de teste**.
4. Crie no mínimo:
   - **Vendedor** (recebe pagamentos)
   - **Comprador** (realiza a compra)
5. Garanta que comprador e vendedor estejam no **mesmo país**.
6. Salve os dados gerados (usuário, senha, user id e código de 6 dígitos, quando aplicável).

## 3) Configurar ambiente de teste no Checkout Pro

1. No seu backend, use o **Access Token de teste** da aplicação.
2. Gere a preferência/sessão de checkout do Checkout Pro em ambiente de teste.
3. Inicie o fluxo de compra pela sua aplicação/loja.

> Importante: não misture token de produção com fluxo de teste.

## 4) Simular compra no Checkout Pro (cartão)

Durante o checkout:

1. Use o e-mail do comprador de teste: `test@testuser.com`.
2. Preencha cartão com um cartão de teste:
   - Mastercard: `5031 4332 1540 6351` (CVV `123`, validade `11/30`)
   - Visa: `4235 6477 2802 5682` (CVV `123`, validade `11/30`)
   - Amex: `3753 651535 56885` (CVV `1234`, validade `11/30`)
3. Para simular resultado, use no nome do titular:
   - `APRO` -> aprovado
   - `FUND` -> recusado por saldo insuficiente
   - `SECU` -> recusado por CVV inválido
   - `OTHE` -> erro geral
   - `CONT` -> pendente
4. Conclua o pagamento.

## 5) Validar o resultado da transação

Após a tentativa de pagamento:

1. Consulte a transação/order pela API (`GET /v1/orders/{id}`), usando o `id` retornado na criação.
2. Verifique `status` e `status_detail`.
3. Confirme se o resultado retornado bate com o cenário simulado (`APRO`, `FUND`, `SECU` etc.).

## 6) Fluxo mínimo recomendado de testes (Checkout Pro)

Execute pelo menos estes cenários:

1. **Aprovado** (`APRO`)
2. **Recusado por fundos** (`FUND`)
3. **Recusado por segurança** (`SECU`)
4. **Pendente** (`CONT`)

Para cada cenário:

- Validar o status no retorno da API.
- Validar atualização no seu sistema (pedido/pagamento).
- Validar notificações (webhook), se já estiver configurado.

## 7) Erros comuns

- Usar credenciais de produção no fluxo de teste.
- Testar comprador e vendedor com países diferentes.
- Não salvar o `id` da order/transação para validação posterior.
- Considerar somente o retorno de tela e não validar via API.

## 8) Referências oficiais

- Contas de teste: https://docs02.mercadopago.com.br/developers/pt/docs/checkout-api-payments/additional-content/your-integrations/test/accounts
- Testes de integração (Checkout): https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test
- Cartões e cenários de teste: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-v2/integration-test/cards

