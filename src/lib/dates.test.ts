import { describe, expect, it } from "vitest";

import { isOpenToday, parseFrenchDateFromText } from "@/lib/dates";

describe("dates", () => {
  it("considere une fenetre rolling comme ouverte", () => {
    expect(isOpenToday({ rolling: true }, new Date("2026-03-16T12:00:00.000Z"))).toBe(true);
  });

  it("retourne faux si la date de cloture est depassee", () => {
    expect(
      isOpenToday(
        {
          opensAt: new Date("2026-01-01T00:00:00.000Z"),
          closesAt: new Date("2026-03-01T00:00:00.000Z"),
          rolling: false,
        },
        new Date("2026-03-16T12:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("parse une date francaise", () => {
    expect(parseFrenchDateFromText("Date limite: 18 avril 2026")?.toISOString()).toBe(
      "2026-04-18T12:00:00.000Z",
    );
  });
});
