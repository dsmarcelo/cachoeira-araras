# Cachoeira das Araras — Sistema de Vouchers

Este repositório contém o website de venda e gestão de vouchers da Cachoeira das Araras.

## Documentação principal

A documentação foi organizada em múltiplos arquivos na pasta [`docs/`](./docs/README.md), com foco em manutenção por solo dev:

- visão do produto e fluxos;
- arquitetura técnica;
- mapa de rotas;
- modelo de dados e settings;
- playbook de manutenção.

## Comandos

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test:payments
pnpm type-check
pnpm build
```

## Variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto usando `.env.example` como base. O schema principal fica em `src/env.js`; variaveis vazias sao tratadas como ausentes.

### Obrigatorias para rodar localmente

| Key | Uso |
| --- | --- |
| `MERCADOPAGO_TOKEN` | Access token do Mercado Pago usado para criar preferencias e consultar pagamentos. |
| `NEXT_PUBLIC_CONVEX_URL` | URL `.convex.cloud` do deployment remoto de desenvolvimento. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | URL `.convex.site` do mesmo deployment, usada pelo proxy do Better Auth. |
| `MERCADOPAGO_WEBHOOK_SERVICE_SECRET` | Segredo compartilhado com o deployment Convex para confirmar pagamentos pelo webhook. |

A origem publica do app (`SITE_URL`) fica no deployment Convex, nao no `.env`; veja [Autenticacao do admin](#autenticacao-do-admin).

`DATABASE_URL` e opcional: conexao somente com o PostgreSQL legado, usada pela importacao ao Convex e pelo teste E2E de pagamentos; veja o [runbook de corte](./docs/operations/postgres-to-convex-cutover.md).

### Exportar do PostgreSQL e importar no Convex (em lote)

Alternativa ao `pnpm import:postgres-to-convex`, que faz uma mutation a cada 10 vouchers e consome muito do limite gratuito do Convex. O export gera um unico arquivo e o `convex import` o carrega de uma vez.

```bash
# 1. Le o PostgreSQL (somente leitura, usa DATABASE_URL do .env.local) e grava .import-data/vouchers.jsonl
pnpm export:postgres-to-convex

# 2. Importa no deployment de desenvolvimento (CONVEX_DEPLOYMENT do .env.local)
pnpm exec convex import --table vouchers --append .import-data/vouchers.jsonl
```

Depois de qualquer importacao em lote (e no primeiro deploy do resumo financeiro), rode os dois comandos abaixo, nesta ordem. Sem eles a busca da tabela admin nao encontra os vouchers importados e a pagina Financeiro mostra totais desatualizados:

```bash
# 3. Preenche purchasedAt, searchText e isActive que faltarem (seguro rodar de novo)
pnpm exec convex run migrations:backfillVoucherPurchasedAtAndSearchText

# 4. Recalcula os resumos diarios (financeDays) a partir dos vouchers
pnpm exec convex run finance:rebuildAll
```

- Os dois comandos rodam em lotes agendados e terminam alguns segundos depois de retornar; rode o 4 so depois que o 3 terminar.
- Para producao, acrescente `--prod` aos dois comandos. Detalhes em [docs/internals/finance-summaries.md](./docs/internals/finance-summaries.md).
- Se alguma linha nao puder ser convertida, o export lista os erros e nao grava arquivo.
- `--append` nao evita duplicados por codigo: se a tabela ja tem vouchers importados, use `--replace` (apaga a tabela antes) ou exporte so o que falta.
- Para producao, acrescente `--prod` ao `convex import`, seguindo o [runbook de corte](./docs/operations/postgres-to-convex-cutover.md).
- `.import-data/` esta no `.gitignore` porque contem nomes e telefones de clientes; apague a pasta depois de importar.

### Pagamentos e webhooks

| Key | Uso |
| --- | --- |
| `WEBHOOK_SECRET` | Segredo usado para validar a assinatura do webhook do Mercado Pago. Configure em producao para nao usar o fallback local. |

As preferencias do Mercado Pago sao criadas com `/api/webhook?source_news=webhooks`, forçando Webhooks assinados. IPN legado (`topic`/`id`) nao e aceito pelo handler.

### Teste automatico de pagamentos

Use `pnpm test:payments` para rodar um teste E2E automatico sem agente de IA. O teste cria uma preferencia real no Mercado Pago, grava um voucher pendente no banco e confere nome, telefone, quantidades, codigo e `preference_id`.

### Dados para teste de pagamento (Mercado Pago Sandbox)

Para realizar testes manuais de compra no Checkout do Mercado Pago em ambiente sandbox:

> [!IMPORTANT]
> **Atenção:** Para testar o pagamento, **deve-se fazer login na conta de teste antes** de prosseguir com o pagamento (recomenda-se utilizar uma janela anônima para evitar conflitos de sessão com a conta real ou de vendedor do Mercado Pago).

#### Conta de teste (Buyer Test User)

| Campo | Valor |
| --- | --- |
| Perfil | Comprador (`Buyer Test User`) |
| País | Brasil |
| User ID | `1915367917` |
| Usuário | `TESTUSER1953398469` |
| Senha | `MuFMnTEBR3` |
| Código de verificação | `367917` |

#### Conta de teste (Seller Test User)

| Campo | Valor |
| --- | --- |
| Perfil | Vendedor (`Seller Test User`) |
| País | Brasil |
| User ID | `1896707113` |
| Usuário | `TESTUSER1310489545` |
| Senha | `BN9TIEH7HO` |
| Código de verificação | `707113` |

#### Cartão de crédito de teste

| Campo | Valor |
| --- | --- |
| Bandeira | Mastercard |
| Número | `5480 8328 0103 3311` |
| Código de segurança | `123` |
| Data de validade | `11/30` |
| Nome do titular | `APRO` (status: pagamento aprovado) |
| CPF | `12345678909` |

### Precos e comportamento publico

| Key | Padrao | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_VOUCHER_PRICE` | `70` | Preco base do voucher adulto. |
| `NEXT_PUBLIC_POOL_VOUCHER_PRICE` | `70` | Preco base do voucher com piscina. |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `false` | `"true"` liga o Vercel Analytics no layout; qualquer outro valor desliga. |
| `NEXT_PUBLIC_VERCEL_URL` | Nao definido | URL publica de preview do Vercel usada como fallback para imagens/links. Normalmente preenchida pela plataforma. |
| `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` | Nao definido | URL publica de producao do projeto no Vercel usada como fallback para imagens/links. Normalmente preenchida pela plataforma. |

Os precos cobrados e exibidos vem das variaveis do deployment Convex (em reais), nao das configuracoes no banco. Configure `NEXT_PUBLIC_VOUCHER_PRICE` e `NEXT_PUBLIC_POOL_VOUCHER_PRICE` no ambiente Convex com os mesmos valores do `.env` da aplicacao (`pnpm exec convex env set NOME VALOR`). Se omitidas no Convex, ambas usam R$ 70,00.
Os valores aceitam ponto ou virgula decimal e sao arredondados para centavos. Um valor positivo menor que R$ 0,01, como `0,0001`, cobra R$ 0,01.

### Marketing e notificacoes opcionais

| Key | Uso |
| --- | --- |
| `FACEBOOK_PIXEL_ID` | Pixel ID usado no envio de conversoes pelo webhook. |
| `FACEBOOK_ACCESS_TOKEN` | Token da Conversions API do Facebook. |
| `GOOGLE_ANALYTICS_MEASUREMENT_ID` | Measurement ID usado no Measurement Protocol do GA4. |
| `GOOGLE_ANALYTICS_API_SECRET` | API secret usado no Measurement Protocol do GA4. |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Pixel ID exposto no client por `src/lib/fbpixel.js`, se essa integracao for usada. |

## Autenticacao do admin

O acesso em `/admin` usa Better Auth com usuario e senha. Os dados e sessoes ficam no deployment remoto do Convex, inclusive durante o desenvolvimento local.

Configure o deployment Convex selecionado uma vez. Os dois comandos de admin solicitam o valor interativamente para nao grava-lo no historico do shell:

```bash
pnpm exec convex env set SITE_URL "https://seu-dominio-ou-tunel"
pnpm exec convex env set AUTH_TRUSTED_ORIGINS "http://localhost:3000"
pnpm exec convex env set BETTER_AUTH_SECRET "<segredo-aleatorio-de-32-bytes>"
pnpm exec convex env set ADMIN_USERNAME
pnpm exec convex env set ADMIN_PASSWORD
pnpm exec convex env set MERCADOPAGO_TOKEN "<access-token-do-mercadopago>"
pnpm exec convex env set MERCADOPAGO_WEBHOOK_SERVICE_SECRET "<segredo-de-servico-webhook>"
pnpm exec convex dev --once
```

Esses valores pertencem ao deployment Convex, nao ao `.env`/`.env.local` do Next.js. `SITE_URL` e a origem publica unica do app — somente protocolo e dominio, sem path — usada pelo Better Auth, pelos `back_urls` do Checkout Pro e pelo webhook do Mercado Pago (`/api/webhook?source_news=webhooks`). Para receber webhooks localmente, use a origem HTTPS de um tunel (ngrok, Cloudflare Tunnel etc.). `AUTH_TRUSTED_ORIGINS` aceita origens adicionais separadas por virgula, como `http://localhost:3000` para desenvolvimento local. Sem flag, os comandos usam o deployment de desenvolvimento selecionado. Configure outros deployments separadamente com `--prod`, `--deployment local` ou `--deployment <nome>`.

Crie o primeiro admin pela funcao interna. Ela le `ADMIN_USERNAME` e `ADMIN_PASSWORD` do deployment e recusa a operacao quando ja existe qualquer usuario:

```bash
pnpm exec convex run authAdmin:createFirstAdmin
```

As variaveis servem somente para esse cadastro inicial. Depois disso, o admin gerencia usuarios em `/admin/dashboard/usuarios` e altera o proprio acesso em `/admin/conta`.
