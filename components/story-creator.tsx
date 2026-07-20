"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { saveBrowserStorySession } from "@/lib/story-session";
import { storyInputSchema } from "@/lib/story";
import {
  safeErrorMessageByCode,
  storyGenerationErrorResponseSchema,
  storyGenerationResultSchema,
} from "@/lib/story-generator";

const fieldClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20";

export function StoryCreator() {
  const router = useRouter();
  const generationLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generationLock.current) return;

    setError(null);
    setHasFailed(false);

    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = storyInputSchema.safeParse(values);

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "请检查故事设定");
      return;
    }

    generationLock.current = true;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const errorResult = storyGenerationErrorResponseSchema.safeParse(body);
        const message = errorResult.success
          ? errorResult.data.error.message
          : safeErrorMessageByCode.UNKNOWN_ERROR;
        setError(message);
        setHasFailed(true);
        return;
      }

      const generationResult = storyGenerationResultSchema.safeParse(body);
      if (!generationResult.success) {
        setError(safeErrorMessageByCode.SCHEMA_VALIDATION_ERROR);
        setHasFailed(true);
        return;
      }

      saveBrowserStorySession(
        generationResult.data.story,
        generationResult.data.story.startNodeId,
        generationResult.data.metadata,
      );
      router.push("/play");
    } catch {
      setError(safeErrorMessageByCode.NETWORK_ERROR);
      setHasFailed(true);
    } finally {
      generationLock.current = false;
      setIsGenerating(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium text-slate-200">
        故事主题
        <input
          className={fieldClassName}
          maxLength={40}
          name="theme"
          placeholder="例如：一座会遗忘名字的车站"
          required
        />
      </label>

      <label className="block text-sm font-medium text-slate-200">
        主角名字
        <input
          className={fieldClassName}
          maxLength={20}
          name="protagonistName"
          placeholder="例如：林夏"
          required
        />
      </label>

      <label className="block text-sm font-medium text-slate-200">
        主角身份
        <input
          className={fieldClassName}
          maxLength={30}
          name="protagonistIdentity"
          placeholder="例如：城市夜班记者"
          required
        />
      </label>

      <label className="block text-sm font-medium text-slate-200">
        故事风格
        <input
          className={fieldClassName}
          maxLength={20}
          name="storyStyle"
          placeholder="例如：温柔治愈"
          required
        />
      </label>

      {error ? (
        <p className="rounded-xl bg-rose-400/10 px-4 py-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="w-full rounded-xl bg-amber-200 px-6 py-3.5 font-semibold text-slate-950 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200 disabled:cursor-wait disabled:opacity-60"
        disabled={isGenerating}
        type="submit"
      >
        {isGenerating ? "正在生成故事…" : hasFailed ? "重新生成" : "生成故事"}
      </button>
    </form>
  );
}
