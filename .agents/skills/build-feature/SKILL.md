---
name: build-feature
description: Guide a feature or meaningful code change from shared understanding through architecture, planning, implementation, verification, and review. Use when implementing a new feature, changing existing behavior, or making a non-trivial product or architectural change.
disable-model-invocation: true
---

# Build Feature

Interview the user relentlessly until you reach a shared understanding. Map this as a design tree: every decision branches into the decisions that hang off it.

Do not write implementation code until the user has explicitly approved the understanding, architecture, and implementation plan.

## 1. Reach shared understanding

Explore the repository before asking questions that the codebase can answer.

Read, when present:

- `AGENTS.md` / `CLAUDE.md`
- existing architecture and developer documentation
- relevant ADRs
- domain/context documentation
- related implementation and tests
- package/framework documentation when current behavior matters

Finding facts is the agent's job. Do not ask the user for information that can be discovered from the repository, tools, or authoritative documentation.

Treat the feature as a decision tree.

Work through the unresolved frontier: ask only questions whose prerequisites are already settled. Group independent questions when useful; defer dependent questions until their prerequisites are answered.

For every meaningful decision:

- explain the decision briefly;
- give the recommended option;
- mention important alternatives or trade-offs when relevant;
- let the user decide.

Clarify at minimum, where applicable:

- intended user behavior;
- success criteria;
- edge cases and failure behavior;
- scope and explicit non-goals;
- domain terminology;
- UI/UX behavior;
- data model changes;
- API/contracts;
- state and synchronization;
- permissions/security;
- compatibility and migrations;
- observability;
- testing expectations;
- rollout or backwards compatibility.

Continue until no material branch remains silently assumed.

Summarize the resulting shared understanding.

Then ask the user explicitly whether you may continue to the architectural decision.

Stop until the user confirms.

## 2. Create the architectural decision record

Inspect existing ADR conventions first. Follow the repository's convention when one exists.

Otherwise store the ADR under:

`docs/adr/NNNN-<decision-slug>.md`

Scan existing ADRs and choose the next available number.

The ADR should record the durable decision, not the implementation procedure.

Keep it concise. Include:

```md
# <Decision title>

<Context: what requires a decision.>

<Decision: what architecture or approach was chosen and why.>

## Considered Options
- <option and relevant trade-off>
- <option and relevant trade-off>

## Consequences
- <important consequence>
- <important constraint>
```

Omit optional sections when they add no useful information.

Do not put transient implementation details, file lists, step-by-step instructions, or code snippets into the ADR unless they represent a durable architectural contract.

If the proposed feature conflicts with an existing ADR, surface that conflict before replacing or superseding it.

Write the ADR into the repository's `docs` architecture area.

Present the completed ADR to the user and ask:

**Is this architectural decision correct?**

If the user requests changes, revise it and ask again.

Do not continue until the user explicitly approves the ADR.

## 3. Write the implementation plan

After the ADR is approved, create the implementation plan.

Do not implement anything yet.

Explore enough of the repository to make the plan concrete and realistic.

Prefer existing architecture, modules, conventions, interfaces, and testing seams over introducing new ones.

The plan must describe the desired result rather than prescribing unnecessary low-level code.

Structure the work as a task graph, not merely a sequential checklist.

Each task should be a small, independently understandable vertical slice whenever possible.

For every task include:

```md
### <Task title>

Goal:
<observable result>

Work:
- <required change>
- <required change>

Verification:
- <test, build, typecheck, runtime check, etc.>

Blocked by:
- <task IDs or "none">
```

Prefer vertical slices that deliver working behavior across the required layers rather than separate "database", "API", and "UI" phases.

Use dependency edges only when a task genuinely cannot begin before another is complete.

Identify opportunities for TDD and the seams at which behavior should be tested.

The plan should include, where applicable:

- repository preparation or prefactoring;
- schema/data changes;
- domain/business logic;
- APIs/contracts;
- UI/client behavior;
- integrations;
- migrations;
- tests;
- documentation required by the feature;
- final integration verification.

Explicitly include:

### Completion Criteria

The feature is not complete until:

- every approved requirement is implemented;
- relevant tests pass;
- typechecking passes;
- lint/build checks required by the repository pass;
- no known requirement from the approved plan remains partial;
- final review finds no unresolved blocking issues.

Present the complete plan to the user.

Ask:

**Is this implementation plan correct?**

Revise until the user explicitly approves it.

## 4. Publish the approved plan

After approval, save the implementation plan to GitHub.

If this repository uses GitHub Issues, create one GitHub issue containing:

- feature/problem summary;
- link or path to the ADR;
- approved implementation plan;
- task IDs;
- blocking relationships;
- completion criteria.

Preserve the task graph and dependency information in the issue.

Use the project's existing labels, milestone, issue conventions, and parent/sub-issue relationships when available. Do not invent project-management conventions when the repository already defines them.

If GitHub cannot be used, stop and explain the blocker rather than silently choosing another tracker.

After publishing the plan, provide its GitHub reference to the user.

Then ask explicitly:

**Should I start implementing the approved plan?**

Do not implement until the user confirms.

## 5. Prepare implementation

Once implementation is approved:

1. Re-read the approved ADR and GitHub plan.
2. Check the current branch.
3. Do not implement directly on `main` or `master`.
4. Create or use a dedicated integration/feature branch.
5. Determine the task graph's current ready frontier.

The main agent acts as orchestrator.

The main agent decides whether one or multiple implementation subagents are appropriate.

Use multiple subagents when:

- two or more ready tasks are genuinely independent;
- they can work without modifying the same tightly coupled area;
- parallel work is unlikely to create unnecessary merge conflicts;
- each task has enough context to be executed independently.

Use a single implementation subagent when:

- only one task is ready;
- tasks are tightly coupled;
- parallelism would create more coordination than value;
- the feature is small enough that concurrency gives little benefit.

Never create subagents merely to increase agent count.

## 6. Choose implementation reasoning level

Implementation agents use **Claude Sonnet 5.5**.

Use **medium effort** by default for:

- well-specified features;
- local changes;
- straightforward business logic;
- isolated UI work;
- normal CRUD/integration work;
- tasks with clear existing patterns.

Use **high effort** when the task involves meaningful complexity such as:

- cross-cutting architecture;
- difficult state management;
- concurrency;
- migrations;
- security-sensitive behavior;
- unfamiliar code;
- subtle compatibility requirements;
- large dependency graphs;
- difficult debugging;
- multiple interacting systems.

The main agent chooses the level per task based on actual complexity.

Do not use high effort automatically.

## 7. Implement through subagents

Treat the approved plan as a task graph.

The ready frontier contains every incomplete task whose blockers are complete.

For each task selected for parallel implementation:

1. create an isolated worktree;
2. create a dedicated branch based on the current integration branch;
3. give the implementation subagent pointers to:
   - the GitHub plan;
   - ADR;
   - relevant repository instructions;
   - task ID;
   - relevant previous commits or research;
4. avoid duplicating large context already available through those pointers;
5. have the subagent implement only its assigned task.

Implementation agents should use TDD where practical at the pre-agreed testing seams.

Prefer:

**red → green → refactor**

Each implementation subagent must:

- stay within its assigned scope;
- follow existing repository conventions;
- avoid unrelated refactors;
- run focused tests regularly;
- run typechecking regularly when applicable;
- verify the observable behavior described by its task;
- commit its completed work;
- report blockers rather than silently changing the approved architecture.

A subagent must not redefine the approved requirements or ADR.

If implementation reveals that the approved architecture or plan is wrong, stop that affected branch of work and return the decision to the user instead of silently deviating.

## 8. Merge the frontier

When an implementation subagent finishes:

1. verify its required checks;
2. merge the latest integration branch into its task branch if necessary;
3. use a merger/review agent when useful to integrate the task into the integration branch;
4. resolve integration problems without weakening requirements or tests;
5. mark that task complete.

Recalculate the ready frontier after each merge.

Start newly-unblocked independent tasks as capacity becomes available.

Continue until the entire task graph is complete.

## 9. Verify the complete feature

After all planned tasks are integrated, verify the feature as a whole.

Run the repository's real verification commands, including applicable:

- unit tests;
- integration tests;
- end-to-end tests;
- typechecking;
- lint;
- production build;
- schema/migration checks.

Run focused tests throughout implementation and the full relevant suite at the end.

A syntax check alone is not sufficient verification.

Compare the finished implementation against:

1. the approved user requirements;
2. the approved ADR;
3. the approved GitHub implementation plan.

Do not declare the feature finished while a known requirement is missing, partial, or unverified.

## 10. Final review

Run final review using separate concerns.

Where subagents are available, run these independently:

### Standards review

Check whether the diff follows:

- repository instructions;
- documented coding standards;
- existing conventions;
- architectural constraints;
- relevant ADRs.

### Spec review

Check whether the diff:

- implements every approved requirement;
- satisfies the GitHub plan;
- respects the ADR;
- introduces unintended behavior or scope creep;
- leaves any task incomplete.

Keep these review contexts separate so conformity does not hide specification mistakes and specification correctness does not hide engineering-quality problems.

Fix blocking findings with an implementation subagent, then rerun the relevant verification.

## 11. Finish

Before declaring completion:

- confirm every plan task is complete;
- run final required checks;
- ensure the integration branch is clean;
- update the GitHub issue according to repository conventions;
- create or update the pull request when appropriate.

Report briefly:

- what was implemented;
- the ADR path;
- the GitHub plan reference;
- verification performed;
- review result;
- any remaining limitations.

Do not claim completion for anything that was not actually verified.
