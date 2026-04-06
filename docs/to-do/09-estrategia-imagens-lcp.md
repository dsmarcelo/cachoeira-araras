# 09) Estrategia de imagens e LCP

## O que sera modificado

- Revisar uso de `images.unoptimized` global e pipeline de assets.

## Arquivos principais

- `next.config.js`
- `src/app/_components/image_carousel.tsx`
- `src/app/_components/swiper-carousel/mini-image-carousel.tsx`
- `public/images/*`

## Implementacao (resumo)

- Avaliar otimizacao seletiva de imagens.
- Padronizar dimensoes, compressao e formatos modernos.
- Manter prioridade apenas para imagens criticas.

## Melhora esperada

- Melhor LCP e experiencia inicial do usuario.
- Uso de banda mais eficiente.

## Checklist do item

- [ ] Mudanca aplicada nos arquivos listados
- [ ] Teste funcional minimo do fluxo afetado
- [ ] `pnpm lint` OK
- [ ] `pnpm type-check` OK
- [ ] `pnpm build` OK
- [ ] Documentacao atualizada quando necessario
