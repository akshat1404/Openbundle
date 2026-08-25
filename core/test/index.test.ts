import { describe, expect, it } from "vitest";
import { ping } from "../src/index.js";

describe("openbundle-core scaffolding", () => {
  it("exposes a working placeholder export", () => {
    expect(ping()).toBe("openbundle-core: ready");
  });
});
