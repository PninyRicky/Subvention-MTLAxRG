import { describe, expect, it } from "vitest";

import { hasRunToday, isScheduledRunWindow } from "@/lib/scheduler";

describe("scheduler", () => {
  it("reconnait un lundi a 06:00 Toronto en ete", () => {
    expect(isScheduledRunWindow(new Date("2026-07-06T10:00:00.000Z"))).toBe(true);
  });

  it("reconnait un mercredi a 06:00 Toronto en hiver", () => {
    expect(isScheduledRunWindow(new Date("2026-01-07T11:00:00.000Z"))).toBe(true);
  });

  it("ignore les heures hors fenetre", () => {
    expect(isScheduledRunWindow(new Date("2026-01-07T10:00:00.000Z"))).toBe(false);
  });

  it("detecte si un run a deja eu lieu aujourd'hui", () => {
    expect(hasRunToday(new Date("2026-03-16T14:00:00.000Z"), new Date("2026-03-16T22:00:00.000Z"))).toBe(true);
  });
});
