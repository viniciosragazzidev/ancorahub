import { describe, expect, it } from "vitest";

import { assertBrokerRegistrationAvailable, brokerRegistrationInput } from "./broker-registration";

const valid = { name: "Ana Corretora", email: "Ana@Example.com", phone: "(11) 99999-0000", cpf: "123.456.789-09", brokerCode: "COR-000042" };

/** Fake transaction: each select().from().where().limit() returns the next queued result. */
function fakeTx(results: Array<Array<{ id: string }>>) {
  const queue = [...results];
  const calls = { count: 0 };
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            calls.count += 1;
            return queue.shift() ?? [];
          },
        }),
      }),
    }),
  };
  return { tx: tx as never, calls };
}

describe("brokerRegistrationInput", () => {
  it("normalizes e-mail, phone and CPF the same way as the broker creation", () => {
    const parsed = brokerRegistrationInput.parse(valid);
    expect(parsed.email).toBe("ana@example.com");
    expect(parsed.phone).toBe("11999990000");
    expect(parsed.cpf).toBe("12345678909");
    expect(parsed.brokerCode).toBe("COR-000042");
  });

  it("turns an empty CPF into null and a blank code into undefined", () => {
    const parsed = brokerRegistrationInput.parse({ ...valid, cpf: "", brokerCode: "   " });
    expect(parsed.cpf).toBeNull();
    expect(parsed.brokerCode).toBeUndefined();
  });

  it("rejects a CPF that does not have 11 digits", () => {
    const result = brokerRegistrationInput.safeParse({ ...valid, cpf: "1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a broker code with spaces or symbols", () => {
    const result = brokerRegistrationInput.safeParse({ ...valid, brokerCode: "COR 42!" });
    expect(result.success).toBe(false);
  });
});

describe("assertBrokerRegistrationAvailable", () => {
  it("checks nothing when no field was sent, so an omitted CPF or code never clears or blocks", async () => {
    const { tx, calls } = fakeTx([]);
    await assertBrokerRegistrationAvailable(tx, { tenantId: "tenant-1", profileId: "profile-1", registration: {} });
    expect(calls.count).toBe(0);
  });

  it("rejects a CPF already used by another broker of the tenant", async () => {
    const { tx } = fakeTx([[{ id: "profile-2" }]]);
    await expect(assertBrokerRegistrationAvailable(tx, {
      tenantId: "tenant-1",
      profileId: "profile-1",
      registration: { cpf: "12345678909" },
    })).rejects.toThrow("Já existe um corretor com este CPF.");
  });

  it("rejects a broker code already used in the tenant", async () => {
    const { tx } = fakeTx([[{ id: "profile-2" }]]);
    await expect(assertBrokerRegistrationAvailable(tx, {
      tenantId: "tenant-1",
      profileId: "profile-1",
      registration: { brokerCode: "COR-000042" },
    })).rejects.toThrow("Já existe um corretor com este código nesta corretora.");
  });

  it("checks each sent field once and passes when nothing else owns them", async () => {
    const { tx, calls } = fakeTx([[], [], []]);
    await assertBrokerRegistrationAvailable(tx, {
      tenantId: "tenant-1",
      profileId: "profile-1",
      registration: { email: "ana@example.com", phone: "11999990000", cpf: "12345678909" },
    });
    expect(calls.count).toBe(3);
  });
});
