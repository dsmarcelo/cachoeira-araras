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
npm run lint
npm run build
```

> Observação: se não existir script `type-check` no `package.json`, rode `pnpm exec tsc --noEmit` como equivalente local.
