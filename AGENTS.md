# Farmstand Experimental

## Domain vocabulary

Before changing behavior, naming, or UI copy that touches garden operations, read [`CONTEXT.md`](./CONTEXT.md). It is the canonical glossary — not an implementation spec.

Reference it when you:

- Implement or rename domain concepts (plants, instances, spaces, slots, sowing schedules, vaults, etc.)
- Write user-facing labels, error messages, or docs that use domain terms
- Are unsure what a term means or whether two terms are the same thing

When adding or changing glossary entries, update `CONTEXT.md` in the same change. Use the project's established terms and avoid synonyms listed under _Avoid_ in the glossary. If code or copy conflicts with `CONTEXT.md`, treat the glossary as the source of truth unless the user directs otherwise.

## Quality Gates

Before submitting any changes, ensure:

1. **Formatting**: Run `npm run format` (Prettier). All code must be formatted.
2. **Linting**: Run `npm run lint` (OxLint). All errors must be resolved; warnings should be addressed when reasonable.
3. **Type checking**: Run `npm run typecheck` (tsc --noEmit). No TypeScript errors.
4. **Tests**: Run `npm run test:run` (Vitest). All tests must pass.
5. **Build**: Run `npm run build`. The project must compile cleanly.
