import { describe, expect, it } from "vitest";

import { openWaPhoneCandidateFilter, openWaSamePhone } from "./phone-candidates";

/** JS mirror of the SQL candidate predicate. */
function isCandidate(value: string | null, phone: string) {
  const digits = (value ?? "").replace(/[^0-9]/g, "");
  return digits.slice(-8) === phone.slice(-8) || digits.length < 8;
}

function randomDigits(length: number) {
  let out = "";
  for (let index = 0; index < length; index += 1) out += String(Math.floor(Math.random() * 3));
  return out;
}

describe("OpenWA phone candidates (egress 16/11)", () => {
  it("never drops a value the in-memory rule would match", () => {
    // Small alphabet so suffix collisions are frequent.
    for (let run = 0; run < 20_000; run += 1) {
      const phone = randomDigits(8 + Math.floor(Math.random() * 6));
      const raw = Math.random() < 0.5 ? phone.slice(-(1 + Math.floor(Math.random() * phone.length))) : randomDigits(Math.floor(Math.random() * 14));
      const value = Math.random() < 0.3 ? `+${raw.slice(0, 2)} (${raw.slice(2, 4)}) ${raw.slice(4)}` : raw;
      if (openWaSamePhone(value, phone)) expect(isCandidate(value, phone)).toBe(true);
    }
  });

  it("matches the usual Brazilian formats", () => {
    expect(openWaSamePhone("+55 (21) 99999-1234", "5521999991234")).toBe(true);
    expect(isCandidate("+55 (21) 99999-1234", "5521999991234")).toBe(true);
    expect(isCandidate("(21) 98888-1234", "5521999991234")).toBe(false);
  });

  it("keeps the full scan for a sender shorter than 8 digits", () => {
    expect(openWaPhoneCandidateFilter({} as never, "1234567")).toBeUndefined();
  });

  it("keeps a stored phone shorter than 8 digits when the sender is longer", () => {
    const sender = "55219999123456";
    const stored = "123456";
    expect(openWaSamePhone(stored, sender)).toBe(true);
    expect(isCandidate(stored, sender)).toBe(true);
    expect(openWaPhoneCandidateFilter({} as never, sender)).toBeDefined();
  });
});
