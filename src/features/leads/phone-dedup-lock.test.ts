import { describe, expect, it } from "vitest";

import { leadPhoneLockKey, lockLeadCreationByPhone, sameLeadPhone } from "./phone-dedup-lock";

function createBarrier(parties: number) {
  let arrived = 0;
  let release!: () => void;
  const open = new Promise<void>((resolve) => { release = resolve; });
  return async () => {
    arrived += 1;
    if (arrived === parties) release();
    await open;
  };
}

describe("tenant-scoped lead phone lock", () => {
  it("uses the Meta protocol key and recognizes formatting variants", () => {
    expect(leadPhoneLockKey("+55 (21) 99876-5432")).toBe("98765432");
    expect(sameLeadPhone("+55 (21) 99876-5432", "21998765432")).toBe(true);
    expect(sameLeadPhone("21998765432", "31998765433")).toBe(false);
  });

  it("locks with the available digits for a short phone instead of skipping the lock", async () => {
    let lockCalls = 0;
    const key = await lockLeadCreationByPhone({ execute: async () => { lockCalls += 1; } } as never, "tenant-1", "(21) 123-45");

    expect(key).toBe("2112345");
    expect(lockCalls).toBe(1);
  });

  it("two simultaneous intake attempts produce one effect under the shared transaction lock", async () => {
    let lockTail = Promise.resolve();
    let created = false;
    let effects = 0;
    const barrier = createBarrier(2);

    const attempt = (phone: string) => (async () => {
      await barrier();
      let releaseTransaction!: () => void;
      const tx = {
        execute: async () => {
          const previous = lockTail;
          lockTail = new Promise<void>((resolve) => { releaseTransaction = resolve; });
          await previous;
        },
      };
      try {
        await lockLeadCreationByPhone(tx as never, "tenant-1", phone);
        if (created) return false;
        created = true;
        effects += 1;
        return true;
      } finally {
        releaseTransaction();
      }
    })();

    const results = await Promise.all([attempt("+55 (21) 99876-5432"), attempt("21998765432")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(effects).toBe(1);
  });
});
