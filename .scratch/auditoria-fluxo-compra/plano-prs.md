# Auditoria do fluxo de compra de voucher — plano de PRs

Data: 2026-09-05
Escopo: fluxo público do cliente (home → formulário → checkout Mercado Pago → retorno → voucher válido).
Ambiente: `localhost:3000` + deployment Convex `elegant-badger-234` + Mercado Pago sandbox.

## Método

Fluxo percorrido de ponta a ponta no navegador: validação do formulário, máscara de
telefone, calendário, criação real de preferência no Mercado Pago (voucher `h2gr`,
R$140) e retorno. A etapa de pagamento no checkout do MP não foi executada; a cadeia
pós-pagamento foi exercitada chamando `POST /webhooks/mercadopago/confirmPayment`
direto no Convex, o que confirmou idempotência (repetição → `already_processed`),
rejeição de segredo inválido (401), código inexistente (`not_found`) e a atualização
reativa das duas telas sem reload.

## Fora de escopo

- **WhatsApp / Twilio** — a integração será removida e reimplementada depois.
- **Pix ausente no checkout** — comportamento do sandbox, não reproduz em produção.
- **Telas de admin** — não auditadas nesta passada.

## O que já está sólido

Vale registrar para não regredir:

- Preço derivado de Site Settings no servidor, nunca do cliente (`validateVoucherPurchase`).
- `confirmPayment` idempotente e fechado por segredo de serviço, sem caminho a partir de sessão autenticada.
- Reatividade Convex no lugar de polling: `/pagamento` vira "Pagamento aprovado" sozinha.
- Retry de código em colisão, com preferência nova em vez de erro para o perdedor.
- `requireRole` correto em `redeemByCode` e `listToday`.

---

## Ordem de execução

Ordenado por esforço crescente. Os PRs 1–6 são todos XS e cabem num único dia.

| # | PR | Tamanho | Impacto |
| --- | --- | --- | --- |
| 1 | Permitir nova compra após pagamento aprovado | XS | Alto |
| 2 | Tela de retorno do pagamento | XS | Médio |
| 3 | Marcar items da preferência como serviço | XS | Médio |
| 4 | Corrigir `WEBHOOK_URL` e base pública local | XS | Baixo |
| 5 | Remover código morto do fluxo público | XS | Baixo |
| 6 | Corrigir textos e marcação inválida | XS | Baixo |
| 7 | Corrigir limite mínimo de data no schema | S | Médio |
| 8 | Mostrar erros de validação em uma passada | S | Médio |
| 9 | Resumo da compra nas telas de voucher | S/M | Alto |
| 10 | Data de visita em fuso São Paulo no cliente | M | Médio |
| 11 | Estorno invalida o voucher | M | Alto |
| 12 | Rate limit em `startCheckout` | M | Alto |
| 13 | Manutenção diária sem full table scan | M/L | Alto |
| 14 | Novo formato de código de voucher | L | Alto |
| 15 | Coletar e-mail do comprador | L | Médio |

---

## PR 1 — `fix(voucher): permitir nova compra após pagamento aprovado`

**Tamanho:** XS · **Impacto:** alto — é o bug mais grave da auditoria.

O ramo `payment_success_url` de [voucher-created-card.tsx:52](../../src/app/_components/voucher-created-card.tsx:52)
não renderiza o `DeleteVoucherCookieBtn`, que só existe no ramo pendente
([:58](../../src/app/_components/voucher-created-card.tsx:58)). Como o cookie `voucher`
dura 40 dias ([lib.ts](../../src/app/lib.ts) — `VOUCHER_COOKIE_MAX_AGE_MS`), o
formulário fica permanentemente substituído pelo card "Visualizar voucher". Um cliente
que compra hoje e volta na semana seguinte não tem como comprar de novo naquele navegador.

**Correção:** expor a mesma ação de "comprar outro voucher" no estado aprovado, com o
texto de confirmação apropriado (o voucher continua válido, só sai do navegador).

**Como verificar:** com um voucher `valid` no cookie, a home deve oferecer o caminho de
volta ao formulário.

---

## PR 2 — `fix(payment): corrige a tela de retorno do pagamento`

**Tamanho:** XS · **Impacto:** médio.

Dois defeitos na mesma tela:

- **Fundo preto.** `StatusScreen` em [payment-status.tsx:117](../../src/app/(client)/pagamento/payment-status.tsx:117)
  não define background e herda o do body, destoando do `bg-bg-blue` do resto do site.
  Combinado com `h-screen` mais a altura do header, o conteúdo estoura em telas baixas.
- **`window.open()`** em [voucher-created-card.tsx:55](../../src/app/_components/voucher-created-card.tsx:55)
  abre nova aba: bloqueado por popup blocker e desorientante no mobile. Trocar por `Link`.

---

## PR 3 — `fix(mercadopago): marca items da preferência como serviço`

**Tamanho:** XS · **Impacto:** médio.

Sem `category_id`, o Mercado Pago trata a compra como produto físico e exibe
"Devolvemos seu dinheiro se você não receber o pacote" no checkout — confirmado no
sandbox. Adicionar `category_id: "services"` ao item em
[convex/lib/mercadopago.ts:126](../../convex/lib/mercadopago.ts:126).

---

## PR 4 — `fix(ops): corrige WEBHOOK_URL e documenta a base pública local`

**Tamanho:** XS · **Impacto:** baixo, mas evita um debug caro no futuro.

- `WEBHOOK_URL` no Convex está como `https://cda-dev.vercel.app/webhook`, **com path**.
  `buildMercadoPagoWebhookUrl` ([mercadopago-checkout.ts:23](../../src/server/mercadopago-checkout.ts:23))
  monta `new URL("/api/webhook", base)` — como o path é absoluto, o `/webhook` da env é
  descartado em silêncio. Funciona por acidente e contraria o README, que pede a URL sem
  path final. Corrigir o valor da env e, de preferência, falhar alto quando a base vier com path.
- Testar checkout no `localhost:3000` sempre devolve o cliente para `cda-dev.vercel.app`,
  porque `resolveSiteBaseForCheckout` lê `URL` do deployment Convex
  ([mercadopago.ts:84](../../convex/lib/mercadopago.ts:84)). Funciona porque os dois
  compartilham o mesmo Convex, mas confunde. Documentar no README junto do fluxo de túnel.

---

## PR 5 — `chore(web): remove código morto do fluxo público`

**Tamanho:** XS · **Impacto:** baixo.

- [`(client)/comprar/page.tsx:7`](../../src/app/(client)/comprar/page.tsx:7) faz
  `redirect("/")` e mantém ~15 linhas de JSX inalcançável depois, incluindo um iframe de
  mapa duplicado.
- `elderly`, `adults_pool` e `elderly_pool` seguem no `voucherFormSchema`, nos
  `defaultValues` e são enviados hardcoded como `0` para `startCheckout`
  ([voucher-form.tsx:120](../../src/app/_components/voucher-form.tsx:120)). O formulário
  público expõe só o voucher inteiro. Decidir: ou remover do schema público, ou reativar.
- `voucher-buy-test.tsx` e o setting `voucher.pool.price` não têm superfície pública —
  confirmar se ainda servem ao admin antes de mexer.

---

## PR 6 — `fix(web): corrige textos e marcação inválida`

**Tamanho:** XS · **Impacto:** baixo.

- Typos visíveis ao cliente: "Nome é obrigatorio" e "codigo"
  ([types.ts:45](../../src/lib/voucher/types.ts:45), voucher-created-card), "utiliza-lo",
  "bebeidas" (card de mais informações).
- `<p>` aninhado dentro de `AlertDialogDescription` (que já renderiza um `<p>`) em
  [delete-voucher-cookie-btn.tsx:44](../../src/app/_components/delete-voucher-cookie-btn.tsx:44) — HTML inválido.

---

## PR 7 — `fix(checkout): corrige o limite mínimo de data no schema`

**Tamanho:** S · **Impacto:** médio.

Em [types.ts:83](../../src/lib/voucher/types.ts:83) o `.min()` do `intendedDate` é
`Date.now() - NEXT_PUBLIC_MAX_INTENDED_DAYS dias`, ou seja: o schema aceita datas até 30
dias **no passado** e não impõe limite futuro nenhum. A regra está invertida. Hoje o
calendário e `validateVisitDate` no servidor seguram, então nada vaza — mas a validação
do formulário não vale nada, e a constante de "máximo de dias no futuro" está sendo usada
como piso no passado.

**Correção:** mínimo = hoje (fuso São Paulo), máximo = hoje + `max.intended.days`.
Idealmente lendo o setting do Convex, não a env pública, para bater com o servidor.

---

## PR 8 — `fix(form): mostra os erros de validação em uma passada`

**Tamanho:** S · **Impacto:** médio.

O `.refine` do telefone ([types.ts:96](../../src/lib/voucher/types.ts:96)) está no nível
do objeto, então só roda depois que **todos** os campos base passam. Confirmado no teste:
com o formulário vazio, apareceram só "Nome é obrigatorio" e "Campo obrigatório" da data;
o erro de telefone só surge depois de corrigir os outros. O usuário corrige um erro por vez.

**Correção:** mover a regra de telefone para um `.superRefine` no próprio campo ou para
um `z.string().refine()` no shape, para que todos os erros apareçam juntos.

---

## PR 9 — `feat(voucher): mostra o resumo da compra nas telas de voucher`

**Tamanho:** S/M · **Impacto:** alto.

Nem o card de voucher criado nem `/pagamento` aprovado mostram data da visita,
quantidade de pessoas ou valor pago — só o código. O cliente sai do fluxo sem nenhum
comprovante do que comprou, e com a saída do WhatsApp isso vira o **único** registro que
ele tem.

`getByCode` já devolve `visitDate`, `adults`, `elderly`, `adultsPool` e `elderlyPool`
([convex/vouchers.ts:50](../../convex/vouchers.ts:50)) — os dados estão disponíveis sem
mudança de backend. O preço não é exposto por essa query; decidir se entra (ela é
pública e sem autenticação, então expor valor pago aumenta a superfície).

---

## PR 10 — `fix(date): usa a chave de data São Paulo no cliente`

**Tamanho:** M · **Impacto:** médio.

O cálculo de datas desabilitadas em [voucher-form.tsx:351](../../src/app/_components/voucher-form.tsx:351)
é frágil por dois motivos:

- `getBrazilianDate` ([date.ts:1](../../src/lib/utils/date.ts:1)) constrói uma data
  "falsa" via `toLocaleString`, cujo horário local coincide com o de São Paulo. O truque
  `yesterday = hoje - 1 dia` só bloqueia o passado porque a data carrega hora; com um
  `Date` zerado a comparação passaria a liberar ontem.
- [linha 363](../../src/app/_components/voucher-form.tsx:363) usa
  `date.toISOString().slice(0, 10)` para casar com `disabled.days`. Isso normaliza em UTC:
  para um visitante em fuso a leste de Greenwich, a meia-noite local vira o dia anterior
  em UTC e o dia bloqueado erra por um.

**Correção:** usar `getSaoPauloDateKey` (já existe e já é o que o servidor usa) e comparar
strings `YYYY-MM-DD` no cliente, eliminando `getBrazilianDate` do caminho do calendário.

---

## PR 11 — `fix(payment): estorno e chargeback invalidam o voucher`

**Tamanho:** M · **Impacto:** alto.

Em [convex/vouchers.ts:478](../../convex/vouchers.ts:478), se o voucher já está `valid` e
o Mercado Pago envia uma notificação posterior com `refunded`, `charged_back` ou
`cancelled`, `confirmPayment` retorna `already_processed` e não faz nada. O voucher
continua resgatável na portaria depois de o dinheiro ter voltado.

**Correção:** tratar os status terminais negativos antes do short-circuit de
`already_processed`, revertendo `valid → pending` (ou um status novo tipo `refunded`).
Definir a regra para `redeemed`: um voucher já usado provavelmente não deve ser revertido,
mas precisa gerar alerta para o admin.

Cobrir com teste em `convex/vouchers.confirmPayment.test.ts`, que já tem a estrutura pronta.

---

## PR 12 — `feat(checkout): rate limit em startCheckout`

**Tamanho:** M · **Impacto:** alto.

`startCheckout` ([convex/vouchers.ts:113](../../convex/vouchers.ts:113)) é uma action
pública sem qualquer throttle, e **cada chamada cria uma preferência real no Mercado
Pago**. O único freio é `findActiveByPhone`, que só bloqueia quando já existe voucher
`valid` — pendentes são ilimitados. O deployment de dev já acumulou 56 vouchers pendentes.

**Correção:** `@convex-dev/rate-limiter` com janela por telefone e um limite global mais
folgado. Vale também um teto de pendentes não expirados por telefone.

---

## PR 13 — `perf(maintenance): manutenção diária sem full table scan`

**Tamanho:** M/L · **Impacto:** alto (falha silenciosa futura).

`runDailyMaintenance` ([convex/maintenance.ts:31](../../convex/maintenance.ts:31)) faz
`ctx.db.query("vouchers").collect()` — a tabela inteira dentro de uma única mutation.
Hoje são ~101 documentos, então passa; nos limites de leitura do Convex isso quebra o cron
quando a tabela crescer, e o sintoma é vouchers que param de expirar sem erro visível ao usuário.

**Correção:** índice por `expiresAt` (e/ou `status`) para varrer só o que venceu, com
paginação por lotes agendados. Os testes em `convex/maintenance.test.ts` já cobrem o
comportamento e devem continuar verdes.

---

## PR 14 — `feat(voucher): novo formato de código de voucher`

**Tamanho:** L · **Impacto:** alto · **Requer migração.**

Três problemas no mesmo lugar ([convex/lib/voucherCode.ts:7](../../convex/lib/voucherCode.ts:7)):

- **Enumerável.** Alfabeto `a-z0-9` com 4 caracteres = 1,68M combinações, e `getByCode` é
  público, sem autenticação e sem throttle. Dá para varrer o espaço e encontrar códigos
  `valid`. Como a portaria valida pelo código, isso é um caminho para entrar com voucher
  alheio. Mitigação parcial: a portaria vê nome e telefone em `listToday` e pode conferir.
- **Viés de módulo.** `byte % 36` sobre bytes de 0–255 não é uniforme (256 mod 36 = 4),
  então `a`–`d` saem com mais frequência.
- **Caracteres ambíguos.** `0/o`, `1/l`, `i/j` num código que é falado em voz alta e
  digitado na portaria.

**Correção:** alfabeto sem ambiguidade (Crockford base32) e comprimento maior — 6
caracteres já levam o espaço para ~1 bilhão. Precisa de plano de migração para os códigos
existentes (aceitar os antigos indefinidamente, gerar novos no formato novo) e de rate
limit em `getByCode`, que sozinho já reduz muito o risco de varredura.

Pode ser feito em duas etapas: rate limit em `getByCode` primeiro (barato, S), formato
novo depois.

---

## PR 15 — `feat(checkout): coleta o e-mail do comprador`

**Tamanho:** L · **Impacto:** médio · **Mudança de produto — precisa de decisão.**

Hoje nenhum e-mail é coletado. Duas consequências:

- A preferência do Mercado Pago vai sem `payer.email`
  ([convex/lib/mercadopago.ts:143](../../convex/lib/mercadopago.ts:143)), então o
  comprador digita tudo de novo no checkout — atrito direto na conversão.
- Com a saída do WhatsApp, não sobra nenhum canal para reenviar o código a quem perdeu a aba.

**Decisão pendente:** adicionar e-mail ao formulário aumenta o atrito de um formulário que
hoje pede só nome, telefone, quantidade e data. Avaliar contra o plano de reimplementar a
confirmação por outro canal.
