# Issue tracker: GitHub

Issues and specs live as GitHub issues. Use the `gh` CLI from this clone; it infers the repository from `origin`.

## Conventions

- Create: `gh issue create --title "..." --body "..."`; use a heredoc for multi-line bodies.
- Read: `gh issue view <number> --comments`; include labels when needed.
- List: `gh issue list --state open --json number,title,body,labels,comments`, with relevant `--label` and `--state` filters.
- Comment: `gh issue comment <number> --body "..."`.
- Label: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- Close: `gh issue close <number> --comment "..."`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

## Skill operations

When a skill says to publish to the tracker, create a GitHub issue. When it says to fetch a ticket, run `gh issue view <number> --comments`.

## Wayfinding operations

`/wayfinder` uses one `wayfinder:map` issue as its map and GitHub sub-issues as child tickets. Where sub-issues are unavailable, link tickets in the map body and add `Part of #<map>` to each child.

- Use `wayfinder:<type>` labels for child types: `research`, `prototype`, `grilling`, or `task`.
- Use GitHub native issue dependencies for blockers. If unavailable, use `Blocked by: #<n>, #<n>` in the child body; a ticket is unblocked only when every blocker is closed.
- The frontier is the first open map child with no open blocker and no assignee.
- Claim with `gh issue edit <n> --add-assignee @me`.
- Resolve by commenting with the answer, closing the child, and appending a context pointer to the map's Decisions-so-far.
