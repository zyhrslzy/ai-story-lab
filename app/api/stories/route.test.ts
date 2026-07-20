import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { storyGenerationResultSchema } from "@/lib/story-generator";

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
    vi.restoreAllMocks();
  });

  it("uses Mock mode by default and returns a valid story", async () => {
    vi.stubEnv("STORY_GENERATOR_MODE", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await POST(storyRequest(validInput));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(storyGenerationResultSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      metadata: { source: "mock", fallbackUsed: false },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid request input", async () => {
    const response = await POST(storyRequest({ ...validInput, theme: "" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_INPUT",
        message: "请检查故事设定后再试",
        requestId: expect.any(String),
      },
    });
  });

  it("returns a stable configuration error when AI mode has no key", async () => {
    vi.stubEnv("STORY_GENERATOR_MODE", "ai");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await POST(storyRequest(validInput));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "NOT_CONFIGURED",
        message: "AI 故事生成暂未配置，请稍后再试",
        requestId: expect.any(String),
      },
    });
  });
});
