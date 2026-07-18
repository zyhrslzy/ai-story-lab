import { describe, expect, it } from "vitest";

import { storyPreview, storyPreviewSchema } from "./story";

describe("storyPreviewSchema", () => {
  it("accepts the bundled three-minute story preview", () => {
    expect(storyPreviewSchema.parse(storyPreview)).toEqual(storyPreview);
  });

  it("rejects a preview that exceeds the MVP duration", () => {
    expect(() =>
      storyPreviewSchema.parse({
        ...storyPreview,
        estimatedMinutes: 4,
      }),
    ).toThrow();
  });
});
