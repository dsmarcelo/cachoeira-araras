# 04: Fix copy and invalid HTML in public flow

**What to build:** Fix visible Portuguese copy errors during purchase and ensure that the Voucher removal dialog produces valid, accessible HTML.

Customer-visible typos identified during the audit:
- "Nome é obrigatorio" and "codigo" in `src/lib/voucher/types.ts:45` and `src/app/_components/voucher-created-card.tsx`.
- "utiliza-lo" and "bebeidas" in the more-information card.

In `src/app/_components/delete-voucher-cookie-btn.tsx:44`, a `<p>` is nested inside `AlertDialogDescription` (which itself already renders a `<p>`), resulting in invalid HTML and React hydration warnings.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Texts identified by the audit use "obrigatório", "código", "utilizá-lo", and "bebidas" correctly across `types.ts`, `voucher-created-card.tsx`, and info cards.
- [ ] The removal dialog in `delete-voucher-cookie-btn.tsx` does not nest `<p>` inside `AlertDialogDescription` or produce hydration warnings and invalid markup.
- [ ] Dialog content and actions remain understandable by screen readers.

Implementation notes:
- PR reference: PR 6 (`fix(web): corrige textos e marcação inválida`) — Size: XS, Impact: Low.
- References: `src/lib/voucher/types.ts:45`, `src/app/_components/voucher-created-card.tsx`, `src/app/_components/delete-voucher-cookie-btn.tsx:44`.
