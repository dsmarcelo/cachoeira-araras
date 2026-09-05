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

- **Nova integração de mensagens**: não faz parte deste plano. A remoção de Twilio/WhatsApp ligado a pagamentos está no PR 9; não há reimplementação prevista aqui.
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

A numeração identifica os PRs, não ordena por esforço. Executar PR 1 → PR 2 → PR 9
para disponibilizar a consulta e a imagem antes de remover o envio por WhatsApp.
Os demais PRs podem seguir separadamente, respeitando as dependências abaixo.
O PR 2 absorve o antigo resumo da compra do PR 9 e passa a ter tamanho M.

| # | PR | Tamanho | Impacto |
| --- | --- | --- | --- |
| 1 | Manter todos os vouchers do cliente acessíveis no navegador | S/M | Alto |
| 2 | Meus Vouchers com imagens via Vercel OG e retorno do pagamento | M | Alto |
| 3 | Marcar items da preferência como serviço | XS | Médio |
| 4 | Corrigir `WEBHOOK_URL` e base pública local | XS | Baixo |
| 5 | Remover código morto do fluxo público | XS | Baixo |
| 6 | Corrigir textos e marcação inválida | XS | Baixo |
| 7 | Corrigir limite mínimo de data no schema | S | Médio |
| 8 | Mostrar erros de validação em uma passada | S | Médio |
| 9 | Remover Twilio/WhatsApp ligado a pagamentos | S/M | Médio |
| 10 | Data de visita em fuso São Paulo no cliente | M | Médio |
| 11 | Estorno invalida o voucher | M | Alto |
| 12 | Rate limit em `startCheckout` | M | Alto |
| 13 | Manutenção diária sem full table scan | M/L | Alto |
| 14 | Novo formato de código de voucher | L | Alto |
| 15 | Coletar e-mail do comprador | L | Médio |

---

## PR 1 — `feat(voucher): manter todos os vouchers do cliente acessíveis no navegador`

Status: implementado em 2026-09-05, sem abertura de pull request.

Entrega: histórico local com retenção de 90 dias, migração pela data original do
servidor, compra independente do cookie e tela básica `/meus-vouchers` com consulta
e remoção individual. O PR 2 amplia essa tela com imagens e resumo da compra.

Validação: 101 testes passaram, TypeScript sem erros e lint sem erros, com 11 avisos
preexistentes. No navegador foram verificados histórico com duas entradas, remoção
individual, migração do cookie, limpeza do ponteiro correspondente, redirecionamento
sem histórico e layout mobile. Convex atualizado apenas no dev `elegant-badger-234`.

**Tamanho:** S/M (revisado de XS) · **Impacto:** alto — é o bug mais grave da auditoria.

O ramo `payment_success_url` de [voucher-created-card.tsx:52](../../src/app/_components/voucher-created-card.tsx:52)
não renderiza o `DeleteVoucherCookieBtn`, que só existe no ramo pendente
([:58](../../src/app/_components/voucher-created-card.tsx:58)). Como o cookie `voucher`
dura 40 dias ([lib.ts](../../src/app/lib.ts) — `VOUCHER_COOKIE_MAX_AGE_MS`), o
formulário fica permanentemente substituído pelo card "Visualizar voucher". Um cliente
que compra hoje e volta na semana seguinte não tem como comprar de novo naquele navegador.

**Correção (escopo ampliado a pedido do Marcelo):** em vez de só destravar a compra de um
novo voucher, o navegador passa a guardar **todos** os vouchers cuja compra foi iniciada nele, para que
o cliente compre um novo e ainda consulte os antigos — com expiração de 90 dias a partir da
criação de cada um.

- **Armazenamento:** lista completa em `localStorage` (chave `vouchers`, formato
  `{ code, initPoint, createdAt }[]`). Puramente client-side, sem viajar em toda requisição
  e sem risco prático de estourar limite de tamanho (diferente de acumular tudo em cookie).
  Ao ler ou gravar a lista, descartar entradas com `createdAt` há mais de 90 dias.
- **Cookie atual (`voucher` / `voucher_init_point`) permanece**, sem mudar de formato, só
  como ponteiro do voucher mais recente — é o que [pagamento/page.tsx:23](../../src/app/(client)/pagamento/page.tsx:23)
  lê no server component para resolver o código quando o retorno do Mercado Pago vem sem
  `external_reference` na URL. Continua sendo escrito junto com a lista em toda nova compra
  ([voucher-form.tsx:167](../../src/app/_components/voucher-form.tsx:167)).
- **Persistência:** adicionar a entrada após `startCheckout` criar o voucher e antes de
  navegar para o Mercado Pago. Migrar o voucher do cookie atual para a lista usando a data
  de criação do servidor, sem renovar artificialmente os 90 dias. O cookie continua apenas
  como fallback do retorno, não como critério de exibição de "Meus Vouchers".
- **UI:** permitir iniciar uma nova compra independentemente dos vouchers existentes.
  A lista fica na tela "Meus Vouchers", implementada no PR 2, e não na home.
  A ação de remover passa a excluir uma entrada específica do navegador, sem cancelar
  o voucher no servidor. Se for a entrada apontada pelo cookie, limpar também esse ponteiro.
- **Acesso:** disponibilizar "Meus Vouchers" somente após a leitura do `localStorage`
  encontrar ao menos uma entrada válida e não vencida pela retenção de 90 dias. Uma compra
  pendente já satisfaz esse critério. Sem entradas, ocultar o acesso e, em visita direta à
  rota, encaminhar para a compra após a hidratação. Tratar armazenamento indisponível ou
  JSON inválido sem quebrar o formulário. Explicar ao cliente quando não for possível salvar.

**Como verificar:** iniciar 2 compras no mesmo navegador deve preservar ambas na lista;
remover uma deve manter a outra. Verificar migração do cookie, descarte após 90 dias e
armazenamento indisponível. A persistência é por origem: retorno em outro domínio não
consegue ler a lista salva no domínio inicial, ponto tratado no PR 4.

---

## PR 2 — `feat(voucher): exibe Meus Vouchers com imagens via Vercel OG`

**Tamanho:** M · **Impacto:** alto · **Depende do PR 1.**

Criar a tela "Meus Vouchers" em `/meus-vouchers`, acessível somente quando houver
voucher salvo no `localStorage`, conforme o PR 1. Listar todas as compras salvas com
status reativo do Convex. Pendentes oferecem retomada do checkout, sem imagem de voucher
pago. Quando o servidor confirmar o pagamento, mostrar a imagem correspondente sem reload.

- Reaproveitar `src/app/api/og/route.tsx`, que já gera uma imagem de 750×375 com
  `ImageResponse` de `next/og`, a implementação de Vercel OG disponível no projeto.
  A imagem pode ser gerada sob demanda ao abrir a tela, sem job no webhook ou arquivo
  persistido. Oferecer visualização e download para cada voucher com pagamento confirmado.
- A rota deve buscar os dados reais no servidor pelo código e verificar a confirmação de
  pagamento. Não aceitar nome, telefone, valor ou status fornecidos por query params como
  fonte de verdade, comportamento atual da rota. `localStorage` controla a descoberta da
  tela, não comprova pagamento nem autoriza dados adicionais. Não ampliar a exposição de
  nome ou telefone pela query pública. A proteção dos códigos continua no PR 14.
- Incluir código, data da visita, quantidades compradas, valor registrado na compra e status
  atual, com data e valor formatados para o cliente. Não recalcular o valor pelos preços
  atuais de Site Settings. O resumo textual acessível acompanha a imagem na tela.
  `getByCode` já expõe data e quantidades; prever o contrato mínimo necessário para o valor,
  pois ele ainda não é retornado. Esta entrega absorve o antigo PR 9 de resumo da compra.
- Remover o cache público imutável de um ano da rota. A resposta deve refletir o estado
  atual e não continuar exibindo um voucher válido após resgate, expiração ou estorno.
  Vouchers pagos resgatados ou expirados permanecem no histórico com seu status, sem
  indicação de entrada válida. O PR 11 deve estender esse comportamento aos estornos.
  Uma imagem baixada é um registro estático; a portaria sempre valida o código no servidor.
- `/pagamento` continua responsável pelo retorno do Mercado Pago e oferece navegação
  na mesma aba para "Meus Vouchers" quando existir uma entrada local. Se o retorno tiver
  código válido mas não houver lista local, recuperar os dados necessários do servidor e
  salvar a entrada antes de oferecer esse acesso. Se não conseguir salvar, manter o status
  e o acesso à imagem do voucher pago no retorno, com aviso sobre a falta de persistência.
- Corrigir também o fundo de `StatusScreen` para o padrão do site e substituir `h-screen`
  por uma altura compatível com o header. Substituir o `window.open()` de
  `voucher-created-card.tsx` por navegação com `Link` na mesma aba.
- Rever `src/app/image-test/page.tsx`, hoje consumidor com dados mockados, para que não
  dependa do contrato antigo nem permita gerar vouchers aparentando pagamento confirmado.

**Como verificar:** sem entrada local, o acesso não aparece e a rota direta retorna à
compra. Com duas compras, a tela mostra ambas; confirmar uma faz aparecer somente sua
imagem. Reabrir o navegador preserva a lista. Conferir download, resumo, mobile, falha de
armazenamento e retorno sem lista. A rota rejeita voucher pendente ou inexistente e ignora
valores/status forjados na URL. Resgate ou expiração não podem manter imagem de entrada válida.

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
  compartilham o mesmo Convex, mas o `localStorage` não é compartilhado entre origens.
  Alinhar a origem da compra e do retorno no ambiente de teste e documentar no README junto
  do fluxo de túnel. Verificar o fallback do PR 2 quando a lista não estiver disponível.

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

## PR 9 — `chore(payment): remove a integração Twilio e WhatsApp de pagamentos`

**Tamanho:** S/M · **Impacto:** médio · **Depende do PR 2.**

Remover o envio automático de confirmação de pagamento por WhatsApp após disponibilizar
"Meus Vouchers" e o download da imagem. Não substituir por outro canal neste PR.

- Remover `src/server/voucher-whatsapp.ts` e sua chamada/import em
  `src/app/api/webhook/route.ts`. Preservar confirmação do pagamento, idempotência e eventos
  de conversão, inclusive a regra de não duplicar conversão em notificações repetidas.
- Revisar o retorno de `confirmPayment` e seus consumidores; remover somente os campos e
  contratos usados exclusivamente pela mensagem. Atualizar comentários sobre WhatsApp em
  `convex/vouchers.ts`, testes e mocks afetados.
- Remover a dependência `twilio` e atualizar o lockfile após confirmar que não há outro
  consumidor. Remover variáveis Twilio da validação de ambiente, exemplos e README,
  incluindo a instrução atual que atribui o envio ao admin. Retirar as configurações dos
  deployments no momento da entrega, após o código deixar de consumi-las.
- Revisar `formatWhatsAppMessage` em `src/lib/utils.ts` e remover se ficar sem consumidores.
  Atualizar instruções que mandam enviar o voucher pelo WhatsApp ou prometem recebê-lo por
  mensagem para apontar para "Meus Vouchers" e o download.
- Links de contato manual com a cachoeira ou com o cliente não são envio automático de
  pagamento. Preservá-los se forem independentes desse fluxo.

**Como verificar:** confirmação e repetição do webhook continuam atualizando o voucher e
respeitando a idempotência dos eventos, sem chamadas Twilio nem necessidade de suas envs.
Conferir referências restantes e executar os testes existentes afetados. Não criar testes
que apenas comprovem a ausência de arquivos ou strings.

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

Atualizar também "Meus Vouchers" e a rota OG do PR 2 para refletir o estado resultante
e não oferecer estornado como entrada válida.

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
- "Meus Vouchers" permite recuperar o código após fechar a aba no mesmo navegador.
  Com a saída do WhatsApp, continua sem canal de recuperação quem limpar o armazenamento,
  trocar de navegador/dispositivo ou ultrapassar a retenção de 90 dias.

**Decisão pendente:** adicionar e-mail ao formulário aumenta o atrito de um formulário que
hoje pede só nome, telefone, quantidade e data. Avaliar a necessidade de recuperação fora do navegador. Coletar e-mail, por si só,
não implementa envio ou recuperação; esse fluxo precisaria de escopo próprio.
