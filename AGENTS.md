# Farmstand Experimental

## Quality Gates

Before submitting any changes, ensure:

1. **Formatting**: Run `npm run format` (Prettier). All code must be formatted.
2. **Linting**: Run `npm run lint` (OxLint). All errors must be resolved; warnings should be addressed when reasonable.
3. **Type checking**: Run `npm run typecheck` (tsc --noEmit). No TypeScript errors.
4. **Tests**: Run `npm run test:run` (Vitest). All tests must pass.
5. **Build**: Run `npm run build`. The project must compile cleanly.
