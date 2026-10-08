# Agent Guidelines

## Commands

- **Typecheck**: `npm run typecheck` — runs `tsc --noEmit`
- **Test**: `npm run test` — runs `vitest run`
- **Build**: `npm run build` — runs `tsc --noEmit && vite build`
- **Lint**: `npm run lint` — runs `eslint .`
- **Format**: `npm run format` — runs `prettier --write .`
- **Dev**: `npm run dev` — runs `vite`

## Project

React + TypeScript + Vite project using Zustand for state, Three.js + @react-three/fiber for 3D,
Tailwind CSS for styling, Zod for schema validation, and browser localStorage persistence.

## Testing

Tests use Vitest with jsdom environment. Run `npm run test` to execute all tests.
