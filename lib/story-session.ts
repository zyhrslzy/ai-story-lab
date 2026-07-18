import { z } from "zod";

import { branchStorySchema, type BranchStory } from "./story";

export const STORY_SESSION_KEY = "ai-story-lab.session.v1";
const browserSessionListeners = new Set<() => void>();

export const storySessionSchema = z
  .object({
    story: branchStorySchema,
    currentNodeId: z.string().min(1),
  })
  .superRefine((session, context) => {
    if (!session.story.nodes.some((node) => node.id === session.currentNodeId)) {
      context.addIssue({
        code: "custom",
        message: "当前节点不存在于故事中",
        path: ["currentNodeId"],
      });
    }
  });

export type StorySession = z.infer<typeof storySessionSchema>;

export interface StoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serializeStorySession(session: StorySession): string {
  return JSON.stringify(session);
}

export function parseStorySession(raw: string | null): StorySession | null {
  if (!raw) return null;

  try {
    return storySessionSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStorySession(
  storage: StoryStorage,
  story: BranchStory,
  currentNodeId = story.startNodeId,
): StorySession {
  const session = storySessionSchema.parse({ story, currentNodeId });
  storage.setItem(STORY_SESSION_KEY, serializeStorySession(session));
  return session;
}

export function loadStorySession(storage: StoryStorage): StorySession | null {
  return parseStorySession(storage.getItem(STORY_SESSION_KEY));
}

export function clearStorySession(storage: StoryStorage): void {
  storage.removeItem(STORY_SESSION_KEY);
}

function notifyBrowserSessionChange(): void {
  browserSessionListeners.forEach((listener) => listener());
}

export function saveBrowserStorySession(
  story: BranchStory,
  currentNodeId = story.startNodeId,
): StorySession {
  const session = saveStorySession(window.localStorage, story, currentNodeId);
  notifyBrowserSessionChange();
  return session;
}

export function clearBrowserStorySession(): void {
  clearStorySession(window.localStorage);
  notifyBrowserSessionChange();
}

export function getBrowserStorySessionSnapshot(): string | null {
  return window.localStorage.getItem(STORY_SESSION_KEY);
}

export function subscribeToBrowserStorySession(callback: () => void): () => void {
  browserSessionListeners.add(callback);

  return () => {
    browserSessionListeners.delete(callback);
  };
}
