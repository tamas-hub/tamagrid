import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryDrawer } from "./index";

describe("HistoryDrawer", () => {
  it("expands history and continues it in the selected pane", () => {
    const onToggleThread = vi.fn();
    const onContinue = vi.fn();
    const thread = {
      id: "thread-history",
      name: "過去のtask",
      preview: "履歴を確認する",
      cwd: "C:\\repo",
      createdAt: 1_785_960_000,
      updatedAt: 1_786_046_400,
      modelProvider: "openai",
      status: "notLoaded",
    };
    render(
      <HistoryDrawer
        open
        connected
        threads={[thread]}
        selectedPaneTitle="Thread C"
        canContinue
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onRefresh={vi.fn()}
        onLoadMore={vi.fn()}
        onToggleThread={onToggleThread}
        onContinue={onContinue}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /過去のtask/ }));
    expect(onToggleThread).toHaveBeenCalledWith("thread-history");
    fireEvent.click(screen.getByRole("button", { name: "Thread Cで継続" }));
    expect(onContinue).toHaveBeenCalledWith(thread);
  });
});
