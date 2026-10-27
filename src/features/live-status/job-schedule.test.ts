import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formatJobHeartbeat, jobHealth, parseJobHeartbeat } from "./heartbeat-format";
import { alignToJobRun, cronIntervalMs, JOB_SCHEDULE, nextJobRunAt, nextRunAt } from "./job-schedule";

const at = (iso: string) => new Date(iso);

describe("nextRunAt", () => {
  it("cada minuto: o próximo minuto cheio, estritamente depois de agora", () => {
    expect(nextRunAt("* * * * *", at("2026-10-27T13:00:30.000Z")).toISOString()).toBe("2026-10-27T13:01:00.000Z");
    expect(nextRunAt("* * * * *", at("2026-10-27T13:01:00.000Z")).toISOString()).toBe("2026-10-27T13:02:00.000Z");
  });

  it("passos de 2, 5 e 10 minutos", () => {
    expect(nextRunAt("*/2 * * * *", at("2026-10-27T13:01:10.000Z")).toISOString()).toBe("2026-10-27T13:02:00.000Z");
    expect(nextRunAt("*/5 * * * *", at("2026-10-27T13:05:00.000Z")).toISOString()).toBe("2026-10-27T13:10:00.000Z");
    expect(nextRunAt("*/10 * * * *", at("2026-10-27T13:51:00.000Z")).toISOString()).toBe("2026-10-27T14:00:00.000Z");
  });

  it("de hora em hora e o resumo diário das 22:00 UTC (19:00 em São Paulo)", () => {
    expect(nextRunAt("0 * * * *", at("2026-10-27T13:00:01.000Z")).toISOString()).toBe("2026-10-27T14:00:00.000Z");
    expect(nextRunAt("0 22 * * *", at("2026-10-27T22:30:00.000Z")).toISOString()).toBe("2026-10-28T22:00:00.000Z");
  });

  it("recusa forma de cron que o runbook não usa", () => {
    expect(() => nextRunAt("0 9 * * 1", at("2026-10-27T13:00:00.000Z"))).toThrow();
    expect(() => nextRunAt("1-5 * * * *", at("2026-10-27T13:00:00.000Z"))).toThrow();
  });

  it("intervalo entre rodadas", () => {
    expect(cronIntervalMs("*/2 * * * *", at("2026-10-27T13:00:30.000Z"))).toBe(120_000);
    expect(cronIntervalMs("0 22 * * *", at("2026-10-27T13:00:30.000Z"))).toBe(24 * 3_600_000);
  });
});

describe("alignToJobRun", () => {
  const now = at("2026-10-27T13:00:30.000Z");
  it("evento futuro sai na primeira rodada a partir dele", () => {
    expect(alignToJobRun("distribution", at("2026-10-27T13:03:10.000Z"), now).toISOString()).toBe("2026-10-27T13:04:00.000Z");
    expect(alignToJobRun("distribution", at("2026-10-27T13:04:00.000Z"), now).toISOString()).toBe("2026-10-27T13:04:00.000Z");
  });
  it("evento já vencido sai na próxima rodada", () => {
    expect(alignToJobRun("distribution", at("2026-10-27T12:00:00.000Z"), now).toISOString()).toBe("2026-10-27T13:02:00.000Z");
  });
});

describe("tabela espelha o runbook", () => {
  it("todo caminho e cron da tabela está no runbook do Coolify", () => {
    const runbook = readFileSync(join(process.cwd(), "docs/runbooks/coolify-scheduled-tasks.md"), "utf8");
    for (const job of Object.values(JOB_SCHEDULE)) {
      expect(runbook).toContain(`| \`${job.path}\` | \`${job.cron}\` |`);
    }
  });
  it("todas as rodadas futuras são calculáveis", () => {
    for (const job of Object.keys(JOB_SCHEDULE) as Array<keyof typeof JOB_SCHEDULE>) {
      expect(nextJobRunAt(job, at("2026-10-27T13:00:30.000Z")).getTime()).toBeGreaterThan(at("2026-10-27T13:00:30.000Z").getTime());
    }
  });
});

describe("heartbeat", () => {
  it("grava e lê o valor curto", () => {
    const value = formatJobHeartbeat({ finishedAt: at("2026-10-27T13:00:12.000Z"), outcome: "ok", durationMs: 812.4 });
    expect(value).toBe("2026-10-27T13:00:12.000Z|ok|812");
    expect(parseJobHeartbeat("distribution", value)).toEqual({ job: "distribution", finishedAt: "2026-10-27T13:00:12.000Z", outcome: "ok", durationMs: 812 });
    expect(parseJobHeartbeat("distribution", "lixo")).toBeNull();
    expect(parseJobHeartbeat("distribution", null)).toBeNull();
  });

  it("parado depois de 3 ciclos sem rodar; sem heartbeat é desconhecido", () => {
    const now = at("2026-10-27T13:10:00.000Z");
    const beat = (iso: string) => ({ job: "distribution" as const, finishedAt: iso, outcome: "ok" as const, durationMs: 1 });
    expect(jobHealth("distribution", beat("2026-10-27T13:05:00.000Z"), now)).toBe("ok");
    expect(jobHealth("distribution", beat("2026-10-27T13:03:59.000Z"), now)).toBe("atrasado");
    expect(jobHealth("distribution", null, now)).toBe("desconhecido");
  });
});
