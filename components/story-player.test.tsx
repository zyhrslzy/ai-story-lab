// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { generateMockStory } from "@/lib/mock-story-generator";
import { saveStorySession } from "@/lib/story-session";

import { StoryPlayer } from "./story-player";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("StoryPlayer fallback notice", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    router.push.mockReset();
    router.replace.mockReset();
  });

  it("shows a non-blocking notice for a marked Mock fallback", async () => {
    const story = generateMockStory({
      theme: "遗忘的车站",
      protagonistName: "林夏",
      protagonistIdentity: "城市夜班记者",
      storyStyle: "温柔治愈",
    });
    saveStorySession(window.localStorage, story, story.startNodeId, {
      requestId: "fallback-request",
      source: "mock",
      fallbackUsed: true,
      attemptCount: 2,
      fallbackReason: "TIMEOUT",
    });

    render(<StoryPlayer />);

    expect((await screen.findByRole("status")).textContent).toContain(
      "AI 暂时不可用，已为你加载示例故事。",
    );
    expect(screen.getByText(story.title)).toBeTruthy();
  });
});
