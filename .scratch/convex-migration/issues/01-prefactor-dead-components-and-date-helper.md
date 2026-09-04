# 01: Remove dead components and extract the Sao Paulo date helper

**What to build:** The codebase loses four components nothing renders, and gains one shared
helper that answers "what day is it in Sao Paulo" for every caller. Nothing a visitor or a
staff member sees changes; this exists so the Convex code inherits a correct operational day
from its first line rather than reproducing the current UTC bug.

Cut from `main`, merged into the Convex branch.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The orphaned duplicate test purchase form component is deleted.
- [x] The three legacy components are deleted.
- [x] Nothing imports any deleted file; the build and typecheck pass.
- [x] A single helper answers the operational-day question in the Sao Paulo zone, and is the
      only place that conversion is written.
- [x] Existing callers that computed the day inline use the helper instead.
- [x] No change to `schema.prisma` or to any data.
