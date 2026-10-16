import { describe, expect, it } from "vitest";

import { parseGroupChats } from "./groups-service";

describe("parseGroupChats", () => {
  it("keeps only group chats and strips the suffix", () => {
    expect(
      parseGroupChats([
        { id: "120363000000000001@g.us", name: "Unimed Corretores" },
        { id: "5521999990000@c.us", name: "Maria" },
        { id: "120363000000000002@g.us", name: "  Amil Vendas  " },
      ]),
    ).toEqual([
      { groupId: "120363000000000001", name: "Unimed Corretores" },
      { groupId: "120363000000000002", name: "Amil Vendas" },
    ]);
  });

  it("reads the serialized id some engines return as an object", () => {
    expect(parseGroupChats([{ id: { _serialized: "120363000000000003@g.us" }, name: "Bradesco" }])).toEqual([
      { groupId: "120363000000000003", name: "Bradesco" },
    ]);
  });

  it("keeps a group without a name and drops repeated or broken entries", () => {
    expect(
      parseGroupChats([
        { id: "120363000000000004@g.us" },
        { id: "120363000000000004@g.us", name: "Repetido" },
        null,
        "texto",
        { id: 7 },
        { id: "@g.us", name: "Sem id" },
      ]),
    ).toEqual([{ groupId: "120363000000000004", name: null }]);
  });
});
