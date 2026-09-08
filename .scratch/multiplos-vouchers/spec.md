# Spec: múltiplos vouchers e pagamentos seguros

Status: ready-for-agent

## Problem Statement

Um visitante pode abandonar um checkout e depois iniciar outras tentativas para o mesmo telefone, sem uma forma clara de retomar ou cancelar a compra anterior. O bloqueio atual também impede uma nova compra quando o telefone já possui um Voucher válido, embora vouchers pagos não devam limitar compras futuras.

O link salvo pelo navegador aponta diretamente para o Mercado Pago e pode ser reaberto sem uma nova verificação do estado do Voucher. A idempotência atual impede que um webhook repetido valide o Voucher duas vezes, mas o modelo guarda somente um pagamento e não distingue uma entrega repetida do mesmo evento de duas cobranças realmente aprovadas. Uma cobrança tardia ou excedente pode ficar sem reembolso e sem aviso ao cliente.

O cancelamento administrativo existente apenas oculta o registro localmente. Ele não invalida a preferência, não cancela pagamentos pendentes e não impede que uma aprovação posterior torne o Voucher válido.

## Solution

Permitir vários vouchers por telefone, limitando apenas a quantidade de compras pendentes a uma. Quando uma tentativa encontrar um Voucher pendente, o navegador que iniciou a compra apresenta seus dados em um diálogo e oferece finalizar o pagamento ou cancelar a compra. Outros navegadores recebem somente um aviso genérico.

O cancelamento passa a ser um fluxo financeiro coordenado. O sistema verifica o Mercado Pago, invalida a preferência e cancela pagamentos que ainda possam ser cancelados. Se já houver pagamento aprovado, ele prevalece e o Voucher torna-se válido. Depois de confirmado o cancelamento, o Voucher permanece terminal. Qualquer aprovação tardia nunca o reativa e inicia um reembolso integral automático.

O primeiro pagamento aprovado é o Official Payment. Toda aprovação adicional é um Excess Payment e recebe Payment Refund integral. O andamento do reembolso é persistido, repetido automaticamente em caso de falha e mostrado no site e em Meus vouchers. O histórico do navegador passa de 90 para 60 dias, com extensão a partir do último evento financeiro e sem remoção enquanto houver reembolso não concluído.

## User Stories

1. Como visitante, quero comprar novos vouchers mesmo que meu telefone já possua vouchers pagos, para planejar mais de uma visita ou comprar para outras pessoas.
2. Como visitante, quero ter somente uma compra pendente por telefone, para não criar cobranças concorrentes sem perceber.
3. Como visitante, quero que vouchers válidos, resgatados, expirados, cancelados ou reembolsados não bloqueiem uma nova compra.
4. Como visitante, quero que um Voucher pendente cuja Visit Date passou deixe de bloquear uma nova compra.
5. Como visitante, quero ser avisado quando o telefone informado já possui uma compra pendente, para decidir o que fazer com ela.
6. Como visitante no navegador original, quero ver Voucher Code, Visit Date, entradas e valor da compra pendente.
7. Como visitante no navegador original, quero finalizar o pagamento pendente sem preencher o formulário novamente.
8. Como visitante no navegador original, quero cancelar a compra pendente para liberar meu telefone.
9. Como visitante, quero confirmar explicitamente o cancelamento, para evitar uma ação acidental.
10. Como visitante, quero ver todos os meus pendentes antigos quando houver mais de um, para resolver dados anteriores ao novo limite.
11. Como visitante com vários pendentes antigos, quero que cada item ofereça suas próprias ações de pagar e cancelar.
12. Como visitante em outro navegador, quero orientação para voltar ao navegador original sem que dados privados sejam revelados.
13. Como titular de um telefone, quero que conhecer meu número não permita consultar ou cancelar minha compra.
14. Como visitante, quero que o site confira o Voucher antes de abrir o checkout, para não tentar pagar algo já pago ou cancelado.
15. Como visitante, quero abrir o Voucher válido quando o pagamento já estiver aprovado, em vez de entrar novamente no checkout.
16. Como visitante, quero que o cancelamento verifique o Mercado Pago antes de concluir.
17. Como visitante, quero que um pagamento já aprovado prevaleça quando tento cancelar.
18. Como visitante, quero que a preferência e pagamentos pendentes sejam cancelados antes de o site confirmar o cancelamento.
19. Como visitante, quero que uma falha temporária do Mercado Pago mantenha a compra pendente e permita nova tentativa.
20. Como visitante, quero que um Voucher cancelado nunca volte a ser válido ou resgatável.
21. Como visitante, quero receber automaticamente o valor integral de qualquer pagamento aprovado depois do cancelamento.
22. Como visitante, quero que o primeiro pagamento aprovado seja o único que valida o Voucher.
23. Como visitante, quero receber automaticamente o valor integral de toda cobrança além do Official Payment.
24. Como visitante, quero que uma cobrança excedente após o resgate seja reembolsada sem desfazer a entrada realizada.
25. Como visitante, quero ver quando um Payment Refund está sendo processado, para saber que o sistema reconheceu a cobrança.
26. Como visitante, quero ver quando o reembolso integral foi confirmado, para saber que o fluxo terminou.
27. Como visitante, quero ser informado quando o reembolso ainda não foi concluído, sem receber uma confirmação prematura.
28. Como visitante, quero acompanhar o reembolso na página inicial e no cartão correspondente em Meus vouchers.
29. Como visitante, quero dispensar o aviso de sucesso na página inicial sem perder o histórico em Meus vouchers.
30. Como visitante, quero que os vouchers deste navegador permaneçam em Meus vouchers por 60 dias.
31. Como visitante, quero que um evento financeiro reinicie a retenção de 60 dias, para ter tempo de acompanhar o ocorrido.
32. Como visitante, quero que um Voucher com reembolso pendente ou falho não possa ser removido de Meus vouchers.
33. Como visitante, quero ocultar um Voucher cancelado sem cobrança ou com reembolso concluído sem apagar o histórico do servidor.
34. Como visitante, quero que a remoção em Meus vouchers continue valendo nas próximas visitas daquele navegador.
35. Como operador, quero que vouchers cancelados e cobranças excedentes nunca apareçam como entradas válidas.
36. Como operador, quero ser alertado quando reembolsos falharem repetidamente, para intervir antes que o caso seja esquecido.
37. Como operador, quero localizar Voucher e contato associados ao reembolso falho, para contatar manualmente o cliente.
38. Como administrador, quero preservar vouchers cancelados, pagamentos e reembolsos para conciliação e investigação.
39. Como administrador, quero retirar registros históricos das listas operacionais sem apagá-los definitivamente.
40. Como desenvolvedor, quero que a restrição de um pendente por telefone seja atômica, para impedir corridas no checkout.
41. Como desenvolvedor, quero distinguir webhook repetido de pagamentos diferentes, para não ignorar cobranças excedentes.
42. Como desenvolvedor, quero registrar cada pagamento pelo identificador do Mercado Pago, para reconciliar cada cobrança.
43. Como desenvolvedor, quero cancelamentos e reembolsos retomáveis e idempotentes, para tolerar falhas e repetições.
44. Como desenvolvedor, quero retentar reembolsos com espaçamento crescente e alertar falhas, para não abandonar cobranças.
45. Como desenvolvedor, quero autorizar ações por uma capacidade opaca do navegador, para que telefone e Voucher Code não permitam cancelamento.

## Implementation Decisions

- O telefone deixa de ter bloqueio por Voucher válido. Somente um Voucher `pending`, não excluído e ainda dentro da Expiry bloqueia nova compra.
- A verificação do limite e a criação do pendente pertencem à mesma transação. Uma verificação anterior pode antecipar conflitos, mas não garante concorrência.
- Se criações concorrentes produzirem preferências antes de uma perder a disputa atômica, a preferência perdedora é invalidada e nunca entregue ao cliente. Falhas na compensação geram nova tentativa e observabilidade.
- Pendentes anteriores à implantação não são apagados nem escolhidos arbitrariamente. O navegador autorizado lista todos os que conhece, e uma compra continua bloqueada enquanto existir algum pendente para o telefone.
- O início da compra retorna uma capacidade opaca e de alta entropia para administrar o Voucher. Ela fica somente no navegador original e não pode ser recuperada por telefone ou Voucher Code.
- A capacidade de administração é diferente da autorização pública de consulta. Conhecer o Voucher Code não permite cancelar, retomar checkout ou revelar conflito encontrado por telefone.
- A resposta de conflito é discriminada. Com capacidade válida, inclui resumo e ações autorizadas; sem ela, informa apenas que há compra pendente e orienta usar o navegador original.
- O resumo autorizado contém Voucher Code, Visit Date, quantidades, preço e estado, sem identificadores financeiros.
- A retomada não reutiliza cegamente um endereço salvo. O servidor confirma que o Voucher continua pendente, não está em cancelamento e não possui Official Payment. Se estiver pago, abre o Voucher; se estiver terminal, não oferece pagamento.
- Links externos já copiados não podem ser totalmente controlados pelo site. A preferência é invalidada quando deixa de ser pagável, e o webhook reembolsa qualquer aprovação que atravesse essa barreira.
- `Cancelled` torna-se estado terminal explícito. Cancelamento preserva o histórico e retira o Voucher da operação; não é exclusão física.
- O cancelamento é público, autorizado pela capacidade do navegador e confirmado explicitamente na interface. Repeti-lo não duplica efeitos.
- Ao começar o cancelamento, o backend registra uma intenção interna para coordenar webhooks concorrentes. Ela não é um novo estado de domínio apresentado ao cliente.
- O fluxo consulta os pagamentos relacionados ao Voucher no Mercado Pago em vez de confiar apenas no identificador local. Uma aprovação já visível torna-se Official Payment e impede o cancelamento.
- Sem aprovação, a preferência é invalidada e pagamentos `pending`, `in_process` ou `authorized` conhecidos são cancelados. O Voucher só se torna `Cancelled` depois das confirmações necessárias.
- Se o provedor falhar, o Voucher permanece `pending`, o cliente recebe mensagem acionável e pode repetir a operação. Passos externos já concluídos são reconhecidos na repetição.
- Uma aprovação posterior a `Cancelled` nunca muda o Voucher. Ela é registrada como Excess Payment e agenda Payment Refund integral.
- Um Voucher expirado também não pode ser reativado por aprovação tardia; eventual cobrança recebe a mesma proteção financeira.
- Cada pagamento observado é persistido separadamente e é único pelo identificador do Mercado Pago. O Voucher se associa a no máximo um Official Payment; demais aprovações são Excess Payments.
- A escolha do Official Payment e o registro do pagamento acontecem atomicamente. Duas aprovações concorrentes não podem validar o mesmo Voucher.
- Reentregar o mesmo evento é idempotente. Um identificador de pagamento diferente representa outra cobrança, ainda que use o mesmo Voucher Code como referência.
- Um Excess Payment nunca altera `valid`, `redeemed`, `expired` ou `Cancelled`. Após resgate, a entrada permanece e somente a cobrança adicional é reembolsada.
- Payment Refund possui estado persistido separado do Voucher: aguardando tentativa, processando, concluído ou necessitando nova tentativa. Valor, tentativas, próxima tentativa e último erro permanecem auditáveis.
- Todo Payment Refund é integral. Tarifas do provedor não reduzem o valor devolvido ao cliente.
- Chamadas externas usam a proteção de idempotência do provedor. A intenção é registrada antes da chamada e o resultado é reconciliado depois, tolerando resposta perdida e repetição.
- Uma ação agendada tenta o reembolso assim que identifica a cobrança excedente. Falhas transitórias usam espaçamento crescente; uma varredura periódica recupera trabalhos vencidos sem agendamento ativo.
- A primeira falha entra no monitoramento técnico. Falhas repetidas geram alerta operacional com Voucher Code, pagamento e contato, sem expor esses dados ao público.
- Durante o reembolso tardio, o cliente vê: “Recebemos um pagamento após o cancelamento. O reembolso integral está sendo processado.”
- Após confirmação, o cliente vê: “O pagamento feito após o cancelamento foi reembolsado.” Para outra cobrança excedente, o texto identifica pagamento duplicado.
- Após falha, o cliente vê: “O reembolso ainda não foi concluído. Continuaremos tentando automaticamente.” O sistema não anuncia conclusão antes da confirmação do Mercado Pago.
- A página inicial mostra aviso destacado para vouchers salvos naquele navegador. O sucesso pode ser dispensado localmente; processamento ou falha permanecem visíveis.
- Meus vouchers mostra o estado financeiro no cartão enquanto a referência existir. Vouchers cancelados ou reembolsados não exibem imagem de entrada válida nem ação de pagamento.
- A retenção padrão do navegador muda de 90 para 60 dias após a criação para todos os vouchers.
- O último evento financeiro observado reinicia a janela local de 60 dias. Payment Refund não concluído impede expiração automática e remoção pela interface, mesmo além dessa janela.
- Após cancelamento sem cobrança ou reembolso concluído, o cliente pode remover a referência local. Isso não apaga Voucher, pagamentos, reembolsos ou alertas administrativos.
- A limitação ao navegador original é aceita nesta versão. Limpeza do armazenamento, troca de dispositivo ou navegação privada podem remover acesso e avisos; não haverá recuperação por telefone, SMS ou WhatsApp.
- Vouchers reais, pagamentos e reembolsos não são apagados automaticamente. Registros terminais saem das consultas operacionais e permanecem para conciliação até existir uma política geral de retenção.
- O diálogo deriva do estado reativo do backend. Mudanças por pagamento, cancelamento ou reembolso em outra aba atualizam ações e mensagens sem recarga manual.

## Testing Decisions

- O principal seam é o fluxo público no limite das funções Convex: checkout, conflito, autorização do navegador, cancelamento, confirmação de pagamento e agendamento de reembolso usam o banco real em memória. Somente o adaptador do Mercado Pago é falso e controlável.
- Bons testes afirmam comportamento externo: estado retornado, Voucher pagável ou terminal, Official Payment escolhido, Excess Payment registrado, Payment Refund solicitado uma vez e resumo autorizado. Não fixam ordem de helpers nem detalhes transitórios sem significado de domínio.
- Os testes existentes de checkout são o prior art para validação, banco em memória, limite por telefone e falso da preferência. Eles serão ampliados para permitir Voucher válido, limitar a um pendente e provar concorrência.
- Os testes existentes de confirmação são o prior art para webhooks repetidos, estados terminais e ausência de entrada financeira pública. Eles serão ampliados para segunda cobrança e aprovações após cancelamento, Expiry e resgate.
- O cancelamento cobre navegador autorizado, navegador sem capacidade, preferência sem pagamento, pagamento cancelável, pagamento aprovado, falha externa, resposta perdida e webhook concorrente.
- O reembolso cobre valor integral, idempotência, sucesso, falha, reagendamento, reconciliação após resposta perdida, alerta por repetição e recuperação de trabalho vencido.
- Um teste força duas aprovações diferentes e prova que exatamente uma vira Official Payment e a outra vira Excess Payment com reembolso.
- Outro teste força duas criações para o mesmo telefone e prova que existe no máximo um pendente, somente uma preferência é entregue e a perdedora é compensada.
- Testes do armazenamento verificam 60 dias, reinício da janela por evento financeiro, preservação de reembolso aberto, remoção após conclusão, persistência da remoção e migração das entradas atuais.
- Testes de UI cobrem somente conteúdo e privacidade do diálogo, ações por estado, confirmação de cancelamento, textos de reembolso, aviso dispensável após sucesso e bloqueio de remoção.
- A verificação manual percorre o servidor já existente: criar compra, repetir telefone, retomar, cancelar, observar Meus vouchers e confirmar que um Voucher pago permite outra compra. Não se inicia outro processo de desenvolvimento.

## Out of Scope

- Confirmar a posse do telefone.
- Recuperar vouchers ou capacidades em outro navegador ou após limpeza do armazenamento.
- Criar login ou conta de cliente.
- Enviar notificações automáticas por SMS, WhatsApp ou e-mail.
- Fazer reembolso parcial.
- Cancelar Voucher cujo Official Payment já foi aprovado.
- Apagar definitivamente o histórico financeiro ou definir a política geral de retenção de dados.
- Alterar regras de chargeback, estorno voluntário do Official Payment ou reativação administrativa, salvo a compatibilidade com o registro separado de pagamentos.
- Garantir que uma sessão externa ou Pix já aberto seja tecnicamente incapaz de concluir. A garantia é que o Voucher não será validado e qualquer cobrança que atravesse a invalidação será reembolsada integralmente.
- Contatar automaticamente o cliente sem o navegador original. Se um reembolso falhar, a equipe recebe contexto para contato manual.

## Further Notes

- O modelo atual guarda somente um identificador de pagamento no Voucher e trata uma segunda aprovação como entrega já processada. A implementação precisa migrar esse significado para Official Payment e criar histórico individual para Excess Payments.
- O estado atual `refunded` agrega reembolso, chargeback e cancelamento do Mercado Pago. Ele continua impedindo resgate, mas não deve representar sozinho o andamento de cada Payment Refund.
- A preferência pode permanecer vigente depois da Expiry local. Toda transição não pagável tenta alinhar a preferência externa; o reembolso automático é a garantia final diante de corridas ou sessões abertas.
- A consulta por telefone nunca retorna Voucher Code ou dados pessoais. A capacidade salva pelo navegador é a única autorização para administrar a compra nesta versão.
- Voucher, Voucher Code, Visit Date, Expiry, Pending, Valid, Redeemed, Expired, Cancelled, Official Payment, Excess Payment e Payment Refund são os termos canônicos desta especificação.
