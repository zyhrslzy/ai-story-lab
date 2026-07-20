// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { StoryCreator } from "./story-creator";

async function fillStoryForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("故事主题"), "遗忘的车站");
  await user.type(screen.getByLabelText("主角名字"), "林夏");
  await user.type(screen.getByLabelText("主角身份"), "城市夜班记者");
  await user.type(screen.getByLabelText("故事风格"), "温柔治愈");
  return user;
}

describe("StoryCreator failure experience", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    router.push.mockReset();
  });

  it("keeps form values and offers regeneration after failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "NETWORK_ERROR",
            message: "网络暂时不稳定，请重新试一次",
            requestId: "request-1",
          },
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<StoryCreator />);
    const user = await fillStoryForm();

    await user.click(screen.getByRole("button", { name: "生成故事" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "网络暂时不稳定，请重新试一次",
    );
    expect(screen.getByRole("button", { name: "重新生成" })).toBeTruthy();
    expect((screen.getByLabelText("故事主题") as HTMLInputElement).value).toBe(
      "遗忘的车站",
    );
    expect((screen.getByLabelText("主角名字") as HTMLInputElement).value).toBe("林夏");
  });

  it("prevents concurrent requests from repeated submissions", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(pendingResponse);
    const { container } = render(<StoryCreator />);
    await fillStoryForm();
    const form = container.querySelector("form");
    if (!form) throw new Error("Story form not found");

    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      (screen.getByRole("button", {
        name: "正在生成故事…",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    resolveRequest?.(
      new Response(
        JSON.stringify({
          error: {
            code: "MODEL_ERROR",
            message: "故事生成服务暂时不可用，请稍后再试",
            requestId: "request-2",
          },
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      ),
    );
    await screen.findByRole("button", { name: "重新生成" });
  });
});
