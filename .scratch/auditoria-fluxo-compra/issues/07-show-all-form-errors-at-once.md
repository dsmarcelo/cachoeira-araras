# 07: Show all form errors at once

**What to build:** Show the customer all known form issues on the first submit attempt, so that name, phone, Visit Date, and quantities can be corrected in a single pass.

In `src/lib/voucher/types.ts:96`, the phone `.refine` is attached at the object level, meaning Zod only evaluates it after all base shape validations pass.

Testing confirmed this problem: when submitting an empty form, only "Nome é obrigatorio" and "Campo obrigatório" (date) were displayed. The phone error only appeared after the user fixed the other fields, forcing the user to resolve errors piecemeal across multiple attempts.

The fix moves the phone validation rule to a `.superRefine` on the field itself or into a `z.string().refine()` within the schema shape, allowing all validation errors to trigger simultaneously.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The phone error appears even when other basic fields (name, date) are also invalid.
- [ ] An empty submission simultaneously displays errors for all applicable required fields.
- [ ] Phone validation rules continue accepting and rejecting the same formats defined for purchase.
- [ ] Focused tests cover multiple simultaneous validation errors without testing internal details of the validation library.

Implementation notes:
- PR reference: PR 8 (`fix(form): mostra os erros de validação em uma passada`) — Size: S, Impact: Medium.
- References: `src/lib/voucher/types.ts:96` (phone `.refine`).
