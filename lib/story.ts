import { z } from "zod";

export const storyPreviewSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  premise: z.string().min(1),
  estimatedMinutes: z.number().int().positive().max(3),
});

export type StoryPreview = z.infer<typeof storyPreviewSchema>;

export const storyPreview: StoryPreview = storyPreviewSchema.parse({
  id: "city-after-rain",
  title: "雨停之后，城市忘记了一盏灯",
  premise:
    "下班路上，你收到一封来自明天的信。两个选择，会把你带向只属于你的治愈结局。",
  estimatedMinutes: 3,
});
