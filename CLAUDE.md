I'm Marcelo. You're my agent.

I love to build. I focus on building complex things as simple as possible. I love to find ways to reduce complexity and make things easier to understand and use.

# Coding preferences - general

- Keep things simple. Channel "yagni" energy unless told otherwise.
- Type safety is useful, take advantage of it.
- Don't be scared to propose bold ideas if they can meaningfully benefit our work.
- Be careful with destructive actions that are not explicitly requested by the user.
- Tests are good! Endless smoke tests, "regression tests" for feature deletions, etc, much less good. Tests should be focused, not slop.
- Comments are a great way to clarify functionality and how code is used. Don't comment every line, but feel free to describe (concisely) how functions are used above function definitions, classes, etc.
- Keep comments and documentation up to date! When making changes, it's important to keep things in sync.
- Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.
- Write code comments in english

# Coding preferences (Typescript focused)

- `any` is the enemy. Inferred types are our friend. Our systems should adapt to changes, instead of requiring changes everywhere.
- If your TS code looks like a Python dev wrote it, it is bad TS code.
- Avoid one-line functions that are just casting wrappers.
- Write TypeScript in ways that Matt Pocock and Theo would be proud of.
- If not already specified in project, I generally like to use the following tech: Convex, Tailwind, React, Vite, pnpm
- When building more complex web and react native apps, I like to pull in Zustand, React Query, Tanstack Start, Clerk (or better-auth if selfhosting), and ArkType (or zod if perf isn't an issue)

# Questions are read-only

- A question is a request for an answer, not for changes. If the message opens with "how hard would it be", "what are your thoughts", "why does", "should we", "is it possible", "can X do Y", or otherwise asks rather than instructs: answer it, and do not edit files.
- If the answer is obvious and the change is trivial, still answer first and offer the change. Ask before making it.

# Match ceremony to the task

- Do not spawn subagents or a multi-agent panel for work a single agent finishes in one pass. Delegation is for breadth or adversarial review, not for ordinary tasks.
- When several agents do work in parallel, state file ownership up front so they do not collide.

# Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- Conventional commit titles, plain language: `fix(web): new threads no longer spike CPU`.
- Body: the problem in a sentence or two, then how you fixed it. End with the model and harness that did the work.
- **Rebase onto latest main before opening.** Stale branches conflict and burn a review round.
- UI changes need before/after images. Motion or timing needs a short video.
- One concern per PR. If the description says "also", split it.

## Taste

- Complexity belongs at the adapter boundary. Orchestration stays pure, UI stays dumb.
- Inferred types over annotations. `any` is the enemy.
- Comments describe how a thing is used, and move when the code moves. To be used mostly to describe functions, not to annotate every line of behavior.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## Testing

- Assume that a dev process of the app is already running, if expo, its localhost:8081, if react, localhost:3000. Don't spin up a new dev using something like pnmp dev or pnpm start. Open localhost in a browser so you can check the results of a ui change.

## Documentation

- **Keep it minimal (< 40 lines per file)**: Document only domain rules, business constraints, limits, and data integrity guarantees.
- **Never document what code already says**: Do not list TypeScript types, component props, hook usage, or Convex API signatures. The code and types are the source of truth for implementation details.
- **No scratch or plan files**: Do not persist temporary plans, mockups, or task logs in `docs/`.
- **Audience split**:
  - `docs/user/`: Product and domain rules (what features do, business constraints, limits). Shipped-product voice, no code paths or technical jargon.
  - `docs/internals/`: Architecture, backend integrity rules, external integrations (R2, Stripe).
  - `docs/operations/`: Deploy runbooks and environment setup.
  - `docs/adr/`: Architectural Decision Records for major structural choices.
- **Keep in sync**: Update the relevant doc only when a domain rule or architecture constraint changes.

# Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing any code.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical role names, recorded as `Status:` lines in issue files. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

