import { describe, expect, it } from "vitest";

import { formatRelativeTime, summarizeLastSync } from "./meta-sync-status";

const now = new Date("2026-09-21T15:00:00.000Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const log = (status: string, minutesAgo: number, itemsSynced = 10) => ({
  status,
  itemsSynced,
  startedAt: ago(minutesAgo + 1),
  completedAt: ago(minutesAgo),
});

describe("formatRelativeTime", () => {
  it("speaks in short pt-BR relative units", () => {
    expect(formatRelativeTime(ago(0), now)).toBe("agora");
    expect(formatRelativeTime(ago(5), now)).toMatch(/5 min/);
    expect(formatRelativeTime(ago(120), now)).toMatch(/2 h/);
    expect(formatRelativeTime(ago(60 * 24), now)).toMatch(/ontem/i);
  });
});

describe("summarizeLastSync", () => {
  it("uses only the most recent log, whatever the array order", () => {
    const summary = summarizeLastSync([log("error", 300), log("success", 5), log("partial", 900)], null, now);
    expect(summary).toMatchObject({ tone: "success", label: "Concluída" });
    expect(summary.detail).toMatch(/min/);
    expect(summary.detail).toContain("10 itens");
  });

  it("maps each sync status to a single tone", () => {
    expect(summarizeLastSync([log("partial", 5)], null, now)).toMatchObject({ tone: "warning", label: "Parcial" });
    expect(summarizeLastSync([log("error", 5)], null, now)).toMatchObject({ tone: "destructive", label: "Falhou" });
    expect(summarizeLastSync([{ ...log("in_progress", 1), completedAt: null }], null, now)).toMatchObject({ tone: "info", label: "Em andamento" });
    expect(summarizeLastSync([log("mystery", 5)], null, now)).toMatchObject({ tone: "secondary", label: "mystery" });
  });

  it("does not claim item counts for a failed sync", () => {
    expect(summarizeLastSync([log("error", 5, 0)], null, now).detail).not.toMatch(/iten|item/);
  });

  it("singularizes one item", () => {
    expect(summarizeLastSync([log("success", 5, 1)], null, now).detail).toContain("1 item");
    expect(summarizeLastSync([log("success", 5, 1)], null, now).detail).not.toContain("1 itens");
  });

  it("falls back to the connection's lastSyncedAt when there are no logs", () => {
    expect(summarizeLastSync([], ago(30), now)).toMatchObject({ tone: "success", label: "Concluída" });
    expect(summarizeLastSync([], ago(30).toISOString(), now).at).toBe(ago(30).toISOString());
  });

  it("says so when it never synchronized", () => {
    expect(summarizeLastSync([], null, now)).toEqual({ tone: "secondary", label: "Nunca sincronizada", detail: "", at: null });
  });

  it("ignores logs with an invalid start date instead of crashing", () => {
    const broken = { status: "success", itemsSynced: 1, startedAt: new Date("nope"), completedAt: null };
    expect(summarizeLastSync([broken], null, now).label).toBe("Nunca sincronizada");
  });
});
