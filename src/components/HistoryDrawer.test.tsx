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
        selectedPaneId="pane-c"
        targetPanes={[
          { id: "pane-a", title: "Thread A", busy: false },
          { id: "pane-b", title: "Thread B", busy: false },
          { id: "pane-c", title: "Thread C", busy: false },
          { id: "pane-d", title: "Thread D", busy: false },
        ]}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onRefresh={vi.fn()}
        onLoadMore={vi.fn()}
        onToggleThread={onToggleThread}
        onSelectPane={vi.fn()}
        onContinue={onContinue}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /過去のtask/ }));
    expect(onToggleThread).toHaveBeenCalledWith("thread-history");
    fireEvent.click(screen.getByRole("button", { name: "Thread Cで継続" }));
    expect(onContinue).toHaveBeenCalledWith(thread);
  });

  it("selects an explicit destination instead of falling back to the first pane", () => {
    const onSelectPane = vi.fn();
    render(
      <HistoryDrawer
        open
        connected
        threads={[]}
        selectedPaneId="pane-a"
        targetPanes={[
          { id: "pane-a", title: "1 · Alpha", busy: false },
          { id: "pane-b", title: "2 · Beta", busy: false },
          { id: "pane-c", title: "3 · Gamma", busy: false },
          { id: "pane-d", title: "4 · Delta", busy: false },
        ]}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onRefresh={vi.fn()}
        onLoadMore={vi.fn()}
        onToggleThread={vi.fn()}
        onSelectPane={onSelectPane}
        onContinue={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("継続先のカラム"), {
      target: { value: "pane-d" },
    });
    expect(onSelectPane).toHaveBeenCalledWith("pane-d");
  });
});
