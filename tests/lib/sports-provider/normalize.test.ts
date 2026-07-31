import { describe, expect, it } from "vitest";

import { parseCommaList, toSlug } from "@/lib/sports-provider/normalize";

describe("toSlug", () => {
  it("lowercases and dashes spaces/punctuation", () => {
    expect(toSlug("Flamengo FC")).toBe("flamengo-fc");
  });

  it("strips diacritics", () => {
    expect(toSlug("São Paulo")).toBe("sao-paulo");
  });

  it("trims leading/trailing dashes from names with leading/trailing symbols", () => {
    expect(toSlug("!Grêmio!")).toBe("gremio");
  });
});

describe("parseCommaList", () => {
  it("splits by comma and trims whitespace around each item", () => {
    expect(parseCommaList("4351, 4501 ,4274,4725")).toEqual([
      "4351",
      "4501",
      "4274",
      "4725",
    ]);
  });

  it("returns a single-item array for a value with no commas", () => {
    expect(parseCommaList("4351")).toEqual(["4351"]);
  });
});
