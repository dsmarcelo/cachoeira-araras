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
pnpm type-check
pnpm build
```

## Autenticacao do admin

O acesso em `/admin` usa sessao do NextAuth com provider de credenciais.

- Defina `ADMIN_PASSWORD_HASH` no `.env`.
- O formato esperado e `scrypt$<salt>$<derived-key-hex>`.
- Para gerar o hash localmente, use o comando abaixo em PowerShell ou Bash:

```bash
pnpm admin:hash -- "sua-senha-admin"
```
