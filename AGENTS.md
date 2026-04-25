# Repository Guidelines

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

## AI Agent Operating Rules

### 1. Explore, plan, then code

For medium or large tasks, do not start coding immediately.

First:

1. inspect the relevant files
2. identify existing patterns to reuse
3. record the problem, objective, scope, and business rules
4. list assumptions as `confirmed by code`, `inferred`, or `uncertain`
5. propose a short implementation plan
6. ask for more information if a requirement is ambiguous, missing, contradictory, or unsafe to infer

Only skip this planning step for very small, mechanical changes such as copy edits, import fixes, formatting, or isolated lint fixes.

---

### 2. Definition of done

Every implementation must satisfy a clear definition of done.

If the user did not provide one, infer a practical one and state it before implementation when the task is non-trivial.

A task is not done until:

* the requested behavior is implemented
* important edge cases are handled
* affected files are listed
* the relevant lint, typecheck, test, or manual validation was run
* failures or unverified parts are explicitly reported
* the final response explains how to test the change manually when UI or behavior changed

If this definition cannot be met because context, commands, credentials, environment, or requirements are missing, ask for the missing information or report the blocker clearly.

---

### 3. Prefer TDD for bugs and business rules

For bugs, regressions, financial calculations, billing rules, permissions, or other business-critical logic:

1. reproduce the issue first when possible
2. create or identify a failing test/check before fixing when the project structure supports it
3. implement the smallest correct fix
4. rerun the test/check
5. report what was verified

If no automated test structure exists, create a minimal focused check when appropriate, or document exact manual validation steps.

---

### 4. Use existing patterns and examples

Before creating a new abstraction, screen, component, hook, service, or styling pattern:

1. search the repository for similar implementations
2. reuse the closest existing pattern
3. keep naming, file structure, data flow, UI states, and styling consistent
4. create something new only when no suitable pattern exists
5. explain why a new pattern was necessary

---

### 5. Review before changing when risk exists

For risky or broad changes, first review the intended diff mentally and describe possible impact before editing.

Focus on:

* real bugs
* regressions
* broken business rules
* performance risks
* permission issues
* React hook issues
* type errors
* inconsistency with existing architecture

If the safest approach is unclear, ask for more information before modifying code.

---

### 6. Work in small increments

For larger tasks, split the work into small stages.

After each stage:

* keep the diff focused
* validate the changed area when possible
* report what changed and what remains
* do not continue into unrelated refactors

If the user asks for a large task without enough detail, propose a staged implementation and start only with the safe, clearly defined portion.

---

### 7. Smallest correct diff

Make the smallest correct change that satisfies the task.

Do not:

* refactor unrelated files
* rename public APIs without need
* rewrite working code for style only
* move files unnecessarily
* change architecture without explaining the reason first
* fix unrelated issues unless they block the requested task

If a larger refactor appears necessary, stop and explain the trade-off before proceeding.

---

### 8. State assumptions before implementation

Before implementing ambiguous tasks, list assumptions explicitly:

* `Confirmed by code`: supported by files inspected
* `Inferred`: likely but not directly confirmed
* `Needs clarification`: cannot be safely inferred

Ask for more information when a `Needs clarification` item affects correctness, data integrity, billing, security, or UX flow.

---

### 9. UI implementation rules

When implementing UI:

* use existing components before creating new ones
* include loading, empty, error, success, invalid form, and not-found states when applicable
* add input validation and character limits where appropriate
* preserve consistency with spacing, typography, navigation, and interaction patterns
* do not add UI libraries without prior authorization

If a design, screenshot, or user requirement cannot be mapped safely to existing components, ask for more information or explain the closest consistent implementation.

---

### 10. Debugging workflow

For non-obvious bugs, debug in cycles:

1. state the current hypothesis
2. identify the evidence needed to confirm or reject it
3. run the smallest relevant command, search, log check, or code inspection
4. update the hypothesis
5. change code only after the likely cause is clear

Do not make random trial-and-error changes.

If the cause cannot be determined from available context, ask for the missing logs, reproduction steps, environment details, or credentials.

---

### 11. Document decisions close to the code

Keep documentation short, practical, and near the implementation.

Document:

* non-obvious business rules
* architectural decisions
* billing and financial flows
* permissions and authorization
* important limitations or trade-offs
* external integration contracts

Do not document:

* trivial behavior already obvious in the code
* redundant comments
* generic text without practical value

If something could be unclear in 30 days, document it.

---

### 12. Retrospective after mistakes

When a mistake, regression, wrong assumption, or repeated correction occurs:

1. identify what instruction or assumption failed
2. explain why the mistake happened
3. propose a short rule that would prevent it
4. add the rule to this file only if it is specific, operational, and likely to be useful again

Avoid vague rules such as “write better code”.

Prefer concrete rules.

## React Data Fetching Architecture

Use Custom Hooks with Derived State.

### Core Rules

1. Avoid unnecessary local state for server state
2. Prefer derived loading state from query state
3. UI components must not depend directly on backend implementation details
4. Hooks should expose a stable interface like `{ data, isLoading, error, ...actions }`
5. Components should call hook actions instead of backend-specific APIs directly

This keeps the UI backend-agnostic and easier to maintain.

## React Hooks Rules

When changing React hooks, verify:

* dependencies of `useEffect`, `useCallback`, and `useMemo`
* stale closures
* functions recreated unnecessarily
* infinite loops
* `react-hooks/exhaustive-deps` warnings
* behavior changes caused by adding or removing dependencies

Do not fix hook lint warnings blindly.

If adding a dependency changes behavior, restructure the code or explain the trade-off.

## Testing and Validation Guidelines

Validation rules:

* Run the most relevant lint/typecheck/test command for the changed area
* If tests do not exist, provide a manual QA checklist
* If a command cannot be run, state exactly why
* Never claim that the change works unless it was verified by a command, test, local run, or clearly described manual validation
* If not verified, explicitly say `not verified` and explain what remains

When adding tests, place them near the feature and use `*.test.ts` or `*.spec.ts` naming.

## Dependency Rules

Do not add production dependencies without prior authorization.

Before proposing a new dependency, explain:

* why it is necessary
* the alternative without the dependency
* expected bundle/runtime impact
* maintenance risk
* whether it affects frontend, backend, or build tooling

Development-only dependencies also require justification when they affect tooling, CI, lint, tests, or code generation.

## Component and Design System Rules

Before creating a component, style primitive, input, button, card, modal, typography variant, or layout helper:

1. search for an existing equivalent
2. reuse the existing component when possible
3. preserve established props and naming conventions
4. avoid duplicating UI primitives
5. explain why a new component is needed if no existing one fits

## Commit & Pull Request Guidelines

* Write concise, imperative commit titles
* Keep one logical change per commit
* Before committing, review the staged diff and ensure no unrelated file is included
* Commit only changes related to the current task
* Include the reason for the change and validation performed when relevant

In PRs, include:

* scope summary
* affected areas
* manual test steps
* screenshots or videos for UI changes
* related issues/tasks when available

## Security & Configuration Tips

Never commit secrets.

Use local environment files and project configuration patterns.

Never invent environment variable values.

If a variable is missing, list the exact required variable and ask for it only when necessary.

Before running destructive or high-risk actions, ask for confirmation.

This includes:

* deleting files
* resetting data
* running migrations
* altering schemas
* installing dependencies
* changing `.env` files
* pushing commits
* touching production or staging services

## Final Delivery Format

Every delivery must include:

1. code changes made
2. intent comments in critical points when applicable
3. a short technical decision note when applicable
4. edge cases handled
5. files changed
6. validation commands run and their results
7. unverified items explicitly marked as `not verified`
8. manual QA steps for UI or behavior changes
9. risks and follow-up items when relevant
