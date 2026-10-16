import { beforeEach, describe, expect, it, vi } from "vitest";

// Each select answers from a queue: the message, the lead, then the broker's membership.
const state = vi.hoisted(() => ({ queue: [] as unknown[][] }));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/storage/r2-storage", () => ({ downloadR2Object: vi.fn(), uploadR2Object: vi.fn() }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: async () => "true" }));
vi.mock("./secret-crypto", () => ({ decryptChannelSecret: vi.fn() }));
vi.mock("./meta-cloud-config", () => ({ getMetaCloudServerConfig: vi.fn() }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  const selectChain = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(state.queue.shift() ?? []).then(resolve, reject);
    return chain;
  };
  return { ...actual, getDatabase: () => ({ select: selectChain }) };
});

import { resolveConversationMediaForViewer } from "./conversation-media";

const audioMessage = { id: "m1", tenantId: "t1", leadId: "l1", phone: "5521", mediaKind: "audio", mediaMimeType: "audio/ogg", mediaFilename: "nota.ogg", mediaStorageKey: "conversation-media/t1/m1.ogg" };

function viewer(role: string, extra: Record<string, unknown> = {}) {
  return { tenantId: "t1", userId: "sup-ana", role, branchId: "b1", ...extra };
}

beforeEach(() => {
  state.queue = [];
});

describe("áudio do histórico do lead: quem pode ouvir pela rota de mídia", () => {
  it("lets the supervisor of the broker's team hear it", async () => {
    state.queue = [[audioMessage], [{ corretorId: "carla", branchId: "b1" }], [{ branchId: "b1", supervisorId: "sup-ana" }]];

    expect(await resolveConversationMediaForViewer({ messageId: "m1", viewer: viewer("supervisor", { supervisorTeamScope: true }) })).toMatchObject({ mediaStorageKey: audioMessage.mediaStorageKey });
  });

  it("denies a supervisor a broker of another team", async () => {
    state.queue = [[audioMessage], [{ corretorId: "carla", branchId: "b1" }], [{ branchId: "b1", supervisorId: "sup-bruno" }]];

    expect(await resolveConversationMediaForViewer({ messageId: "m1", viewer: viewer("supervisor", { supervisorTeamScope: true }) })).toBeNull();
  });

  it("denies a supervisor without the team scope flag, before any membership read", async () => {
    state.queue = [[audioMessage], [{ corretorId: "carla", branchId: "b1" }]];

    expect(await resolveConversationMediaForViewer({ messageId: "m1", viewer: viewer("supervisor", { supervisorTeamScope: false }) })).toBeNull();
    expect(state.queue).toEqual([]);
  });

  it("denies a gestor a lead of another unit", async () => {
    state.queue = [[audioMessage], [{ corretorId: "carla", branchId: "b2" }]];

    expect(await resolveConversationMediaForViewer({ messageId: "m1", viewer: viewer("manager") })).toBeNull();
  });

  it("denies a broker a lead that is not theirs", async () => {
    state.queue = [[audioMessage], [{ corretorId: "outro", branchId: "b1" }]];

    expect(await resolveConversationMediaForViewer({ messageId: "m1", viewer: viewer("broker", { userId: "carla" }) })).toBeNull();
  });

  it("denies a role with no lead scope", async () => {
    state.queue = [[audioMessage], [{ corretorId: "carla", branchId: "b1" }]];

    expect(await resolveConversationMediaForViewer({ messageId: "m1", viewer: viewer("client") })).toBeNull();
  });
});
