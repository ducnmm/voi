# Spec-Driven Development

This project uses a spec-driven development workflow. Implementation should follow written product and technical specs rather than ad hoc feature building.

## Goals

- Keep scope small and intentional.
- Make product decisions visible before engineering work begins.
- Define acceptance criteria before implementation.
- Avoid building generic scheduling software.
- Preserve a minimal, high-quality web experience (with parity in mind for the later iOS channel).

## Workflow

1. Product Intent
   - Define the user problem.
   - Define the target user.
   - Define what success looks like.

2. Feature Spec
   - Write the feature goal.
   - Define in-scope and out-of-scope behavior.
   - Describe user flows.
   - Add acceptance criteria.

3. Technical Design
   - Define data model changes.
   - Define API or service behavior.
   - Define client states and edge cases.
   - Identify risks.

4. Task Breakdown
   - Split implementation into small tasks.
   - Keep tasks tied to acceptance criteria.
   - Include test and verification work.

5. Implementation
   - Build only what the spec covers.
   - Update the spec if a product decision changes.
   - Avoid adding broad abstractions without a clear need.

6. Verification
   - Validate acceptance criteria.
   - Check visual states at mobile and desktop browser widths.
   - Check empty, loading, error, and edge states.

## Spec Status

Each feature spec should use one of these statuses:

- Draft: the concept is being shaped.
- Ready: implementation can begin.
- In Progress: implementation has started.
- Verified: acceptance criteria have been checked.
- Deferred: intentionally not part of the current milestone.

## Definition of Ready

A spec is ready when it has:

- A clear user problem.
- A primary user flow.
- Explicit non-goals.
- Acceptance criteria.
- Data model implications.
- Known edge cases.

## Definition of Done

A feature is done when:

- The implementation satisfies the acceptance criteria.
- Empty, loading, success, and error states are handled where relevant.
- The feature has focused tests or manual verification notes.
- The spec is updated if behavior changed during implementation.

