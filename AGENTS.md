# Repository Guidelines

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project Structure & Module Organization

This repository uses `pnpm` as the package manager.

Keep domain logic close to its runtime:

* UI code inside the application layer
* Shared business logic close to where it is consumed
* Backend/service abstractions separated from presentation logic

Prefer clear separation between:

* UI components
* Hooks
* Data access
* Domain/business rules
* Infrastructure and integrations

## Build, Test, and Development Commands

Run commands from the repository root unless the project requires otherwise.

Prefer:

* `pnpm install`
* `pnpm dev`
* `pnpm build`
* `pnpm lint`
* `pnpm typecheck`
* `pnpm test`

Prefer the most specific and cheapest validation command that proves the change.

If a required command is missing, fails because of the environment, or cannot be safely run, report the exact reason and ask for the missing information only when it blocks a correct implementation.

## Coding Style & Naming Conventions

TypeScript-first.

Follow these conventions:

* Use functional React components
* Use typed props
* Use `camelCase` for variables and functions
* Use `PascalCase` for components and types
* Respect ESLint rules
* Handle errors and edge cases robustly
* Show errors in the UI when applicable
* Validate inputs
* Add character limits where appropriate
* Verify that the intended functionality works correctly

Do not:

* use `any` to silence TypeScript errors
* use `as unknown as` unless there is a clear technical reason
* disable lint rules to make code pass
* disable TypeScript checks to make code pass
* disable hook dependency checks unless explicitly authorized

If a cast is unavoidable, explain why in the final delivery.

