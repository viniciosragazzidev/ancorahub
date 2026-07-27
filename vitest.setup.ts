import { vi } from "vitest";

// server-only lives inside next/dist/compiled/server-only and is resolved
// through Next.js internal module resolution. Vitest can't find it by bare
// import, so we mock it as a no-op.
vi.mock("server-only", () => ({}));
