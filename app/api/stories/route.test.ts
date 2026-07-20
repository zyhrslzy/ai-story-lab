import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { branchStorySchema } from "@/lib/story";

import { POST } from "./route";

const validInput = {
  theme: "遗忘与重逢",
  protagonistName: "林夏",
  protagonistIdentity: "城市夜班记者",
  storyStyle: "温柔治愈",
};

function storyRequest(body: unknown) {
  return new Request("http://localhost/api/stories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/stories", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Mock mode by default and returns a valid story", async () => {
    vi.stubEnv("STORY_GENERATOR_MODE", "");
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await POST(storyRequest(validInput));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(branchStorySchema.safeParse(body).success).toBe(true);
  });

  it("rejects invalid request input", async () => {
    const response = await POST(storyRequest({ ...validInput, theme: "" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_INPUT" },
    });
  });

  it("returns a stable configuration error when AI mode has no key", async () => {
    vi.stubEnv("STORY_GENERATOR_MODE", "ai");
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await POST(storyRequest(validInput));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_CONFIGURED" },
    });
  });
});
