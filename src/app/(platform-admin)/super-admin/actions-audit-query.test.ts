import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  getDatabase: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/shared/auth/platform-admin", () => ({
  getRequiredPlatformAdmin: mocks.admin,
}));
vi.mock("@/shared/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/db")>()),
  getDatabase: mocks.getDatabase,
}));

import { schema } from "@/shared/db";
import { runDbQueryAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ userId: "platform-admin" });
  mocks.select.mockReturnValue({ from: mocks.from });
  mocks.from.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue([]);
  mocks.getDatabase.mockReturnValue({ select: mocks.select });
});

describe("Super-admin audit-log query", () => {
  it("selects explicit legacy columns without requiring audit metadata", async () => {
    await expect(runDbQueryAction("auditLogs", 12)).resolves.toEqual({ success: true, data: [] });

    const [projection] = mocks.select.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(projection)).toEqual(["id", "userId", "entidade", "entidadeId", "acao", "createdAt"]);
    expect(projection).not.toHaveProperty("metadata");
    expect(mocks.from).toHaveBeenCalledWith(schema.auditLogs);
    expect(mocks.limit).toHaveBeenCalledWith(12);
  });
});
