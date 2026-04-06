# Documentação do Projeto — Cachoeira das Araras

Esta pasta reúne uma documentação prática para **uma pessoa desenvolvedora** manter e evoluir o site com segurança.

## Ordem de leitura recomendada

1. [`01-product-overview.md`](./01-product-overview.md)  
   Visão geral do produto, público, fluxos principais e regras de negócio.
2. [`02-architecture-and-stack.md`](./02-architecture-and-stack.md)  
   Como o app é estruturado (Next.js App Router + tRPC + Prisma + Mercado Pago).
3. [`03-routes-and-pages.md`](./03-routes-and-pages.md)  
   Mapa das páginas públicas, admin e endpoints de API.
4. [`04-data-model-and-settings.md`](./04-data-model-and-settings.md)  
   Modelo de dados (Prisma), status do voucher e sistema de configurações dinâmicas.
5. [`05-maintenance-playbook.md`](./05-maintenance-playbook.md)  
   Guia de manutenção: tarefas comuns, checklists e pontos de atenção para mudanças futuras.

## Objetivo desta documentação

- Explicar **o que o app faz**.
- Explicar **como ele funciona por dentro**.
- Facilitar modificações futuras com baixo risco.
- Ajudar a manter consistência entre front-end, regras de negócio e banco.
