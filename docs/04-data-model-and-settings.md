# 04 — Modelo de Dados e Configurações

## Entidades principais (Prisma)

### `Voucher`

Campos essenciais para operação:

- `code` (único): identificador curto usado no atendimento.
- `status`: estado do fluxo (`pending`, `valid`, `redeemed`, `expired`).
- `valid`: flag booleana auxiliar de validade.
- `preference_id`: id da preferência do Mercado Pago.
- `payment_id`: id do pagamento confirmado (quando houver).
- `gclid`: identificador do clique do Google Ads capturado antes da compra.
- `google_ads_conversion_uploaded_at`: marca idempotente do envio da conversão offline ao Google Ads.
- `expires_at`: data planejada de uso/expiração.
- `deletedAt`: soft delete.

Também guarda quantidades e preço final para rastreabilidade da compra.

### `SiteSetting`

Tabela de configuração dinâmica do sistema:

- chave (`key`) + tipo (`type`) + valor em colunas tipadas.
- permite alterar comportamento sem redeploy.

### `Referrer`

Relaciona voucher com origem/referrer para acompanhamento de aquisição.

### Rastreamento Google Ads offline

O `gclid` é capturado no client e salvo diretamente no `Voucher` quando a compra é iniciada. Quando o Mercado Pago confirma um pagamento aprovado, o webhook usa esse valor para enviar a conversão offline ao Google Ads.

`google_ads_conversion_uploaded_at` não representa o pagamento; ele existe apenas para evitar reenvio da mesma conversão offline em webhooks duplicados ou reconciliações tardias.

## Máquina de estados do voucher (prática)

- `pending`: criado, pagamento não confirmado.
- `valid`: pagamento aprovado, pode ser utilizado.
- `redeemed`: já consumido na entrada.
- `expired`: expirou sem uso.

### Regras operacionais associadas

- webhook aprovado move para `valid` e define `valid: true`.
- validação admin move para `redeemed` e `valid: false`.
- cron move vouchers vencidos para `expired` quando ainda válidos.
- cron aplica soft delete em pendentes vencidos.

## Sistema de settings

Acesso centralizado via `src/lib/settings.ts`:

- `getSetting(key)`
- `setSetting(key, value)`
- `getAllSettings()`

### Chaves existentes relevantes

- Preço: `voucher.price`, `voucher.pool.price`.
- Limites de quantidade por tipo.
- Flags de habilitação de compra por modalidade.
- Mensagens textuais (`top.message`, `form.message`).
- Janela de datas (`max.intended.days`, `disabled.days`).

## Onde settings impactam o front

Formulário de compra consome `api.settings.getAll.useQuery()` e aplica:

- bloqueio de tipos de compra desativados;
- mensagens dinâmicas;
- regras de calendário e limites.

Isso reduz hardcode de regra no front e permite ajustes operacionais rápidos.
