import {
  parseLimitParam,
  parseOffsetParam,
} from "../../utils/pagination";

describe("pagination utils", () => {
  it("falls back to defaults for invalid values", () => {
    expect(parseLimitParam("abc", 50)).toBe(50);
    expect(parseLimitParam("-1", 50)).toBe(50);
    expect(parseOffsetParam("abc", 0)).toBe(0);
    expect(parseOffsetParam("-5", 0)).toBe(0);
  });

  it("normalizes valid values and respects an optional maximum", () => {
    expect(parseLimitParam("25", 50)).toBe(25);
    expect(parseLimitParam("250", 50, 100)).toBe(100);
    expect(parseOffsetParam("12", 0)).toBe(12);
  });
});
