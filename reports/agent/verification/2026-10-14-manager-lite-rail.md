# T126: Manager Lite chat rail

- Focused tests: `npm exec vitest run src/features/broker-workspace/chat/chat-rail-data.test.ts src/features/broker-workspace/broker-lite-experience.test.tsx` passed (2 files, 10 tests).
- Type-check: `npm run type-check` passed.
- ESLint: passed for all altered TypeScript files.
- Desktop preview: `tmp/t126/gestor-lite-inicio-desktop-1440.png` (1440x1000, fixture data).
- No database test or production build was run. Turbopack rejected the worktree node_modules junction, so the screenshot used the development server with Webpack.
