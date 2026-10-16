import { describe, expect, it } from "vitest";

import { INITIAL_MESSAGE_FAILURE_NOTE_PREFIX, initialMessageFailureNote } from "./meta-delivery-failure";

// The broker's timeline hides notes that start with this prefix. If the note's wording
// changes without the prefix, the note would reach the broker again.
describe("initial message failure note prefix", () => {
  it("starts every variant of the note", () => {
    expect(initialMessageFailureNote("131049").startsWith(INITIAL_MESSAGE_FAILURE_NOTE_PREFIX)).toBe(true);
    expect(initialMessageFailureNote("130472").startsWith(INITIAL_MESSAGE_FAILURE_NOTE_PREFIX)).toBe(true);
    expect(initialMessageFailureNote("131026").startsWith(INITIAL_MESSAGE_FAILURE_NOTE_PREFIX)).toBe(true);
    expect(initialMessageFailureNote(null).startsWith(INITIAL_MESSAGE_FAILURE_NOTE_PREFIX)).toBe(true);
  });

  it("is free of characters that would act as LIKE wildcards", () => {
    expect(INITIAL_MESSAGE_FAILURE_NOTE_PREFIX).not.toMatch(/[%_]/);
  });
});
