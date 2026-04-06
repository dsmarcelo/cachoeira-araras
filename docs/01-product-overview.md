# 01 — Visão Geral do Produto

## O que este app faz

O projeto é um site de vendas e gestão de vouchers da Cachoeira das Araras. Ele cobre:

- Compra de voucher no front público.
- Pagamento via Mercado Pago.
- Retorno e acompanhamento do pagamento.
- Emissão/visualização do voucher.
- Validação de voucher na área admin.
- Painéis operacionais para acompanhar vouchers do dia, vendas e configurações.

## Perfis de uso

### 1) Cliente final (visitante)

- Entra no site público.
- Seleciona quantidades (inteira/meia, com e sem piscina).
- Informa nome/telefone e data pretendida.
- Vai para pagamento Mercado Pago.
- Após pagamento, acessa a página com dados do voucher.

### 2) Operação interna (admin)

- Consulta vouchers esperados para hoje.
- Valida código de voucher na entrada.
- Marca voucher como utilizado (`redeemed`).
- Ajusta configurações sem deploy (preços, limites, mensagens e flags de venda).

## Fluxo principal ponta-a-ponta

1. Front cria intenção de compra e um código curto do voucher.
2. Sistema cria `preference` no Mercado Pago e salva voucher com status inicial.
3. Cliente paga no checkout do Mercado Pago.
4. Webhook confirma pagamento assinado e atualiza voucher para válido.
5. Cliente vê página de pagamento/voucher.
6. Time do local valida e consome voucher no admin.

## Regras de negócio importantes

- Voucher só deve ser aceito quando pagamento está confirmado.
- Status de voucher é central para operação (`pending`, `valid`, `redeemed`, `expired`).
- Há soft delete para registros expirados/pendentes antigos.
- Existem feature flags para habilitar/desabilitar tipos de compra sem alterar código.

## Modo de teste

Existe uma rota de teste para fluxo de compra com preço simbólico, útil para validar integração sem gerar vendas reais de valor normal.
