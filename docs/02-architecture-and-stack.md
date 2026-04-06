# 02 — Arquitetura e Stack Técnica

## Stack principal

- **Next.js (App Router)** para páginas e API routes.
- **React + TypeScript** na UI.
- **tRPC** para camada de API tipada entre client e server.
- **Prisma** para acesso ao banco PostgreSQL.
- **Mercado Pago SDK/API** para checkout e pagamentos.
- **Tailwind CSS + Radix UI** para interface.

## Organização de diretórios (visão prática)

- `src/app/` — páginas, layouts e rotas API (App Router).
- `src/app/_components/` — componentes de domínio do app (voucher, compra, etc.).
- `src/server/api/routers/` — routers tRPC (voucher, settings, mercadopago etc.).
- `src/lib/` — utilitários, lógica de negócio e integrações.
- `prisma/schema.prisma` — modelo de dados.

## Como as camadas conversam

1. **UI client** usa hooks `api.*` (tRPC React).
2. Hooks chamam procedures em `src/server/api/routers/*`.
3. Procedures usam Prisma (`ctx.db`) e integrações externas.
4. Algumas integrações externas também vivem em API Routes (`src/app/api/*`), por exemplo webhook.

## Desenho dos fluxos críticos

### Fluxo de compra

- `voucher-form` coleta dados.
- Chama `mercadopago.create` para gerar preferência.
- Cria voucher no banco (`voucher.create`) com `preference_id`.
- Redireciona para `init_point` do Mercado Pago.

### Fluxo de confirmação de pagamento

- Mercado Pago envia webhook para `/api/webhook`.
- Assinatura do webhook é validada via HMAC.
- Sistema consulta pagamento e atualiza voucher para status válido quando aprovado.
- Integrações de conversão (Meta/Google Ads) são disparadas sem bloquear a confirmação.

### Fluxo operacional (uso do voucher)

- Admin consulta voucher por código.
- Se válido, pode marcar como utilizado (`redeemed`) e invalidar reutilização.

## Padrões já adotados

- Settings centralizadas em DAL (`src/lib/settings.ts`) com defaults.
- Query única para settings (`settings.getAll`) para reduzir múltiplas requisições.
- Revalidação de página de configurações após update por server action.

## Débitos técnicos visíveis

- Há rotas/arquivos de teste no app router (`test__`, `tests_iE72e7789D3`, etc.).
- Existe mistura de português/inglês em nomes e mensagens.
- Algumas tipagens/nomes poderiam ser padronizados (ex.: typos como `getPrefence`).

Nada disso impede operação, mas vale manter no backlog para limpeza gradual.
