import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentPane } from "./index";

describe("AgentPane", () => {
  it("renders status text and requires a user click for approval", () => {
    const onApproval = vi.fn();
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          title: "Thread A",
          status: "Approval",
          workingDirectory: "C:\\repo",
          events: [],
          approval: {
            id: "n:5",
            message: "pnpm test",
            kind: "command",
            command: "pnpm test",
            cwd: "C:\\workspace",
            canApprove: true,
          },
        }}
        onApproval={onApproval}
      />,
    );

    expect(screen.getByLabelText("ステータス 承認待ち")).toBeVisible();
    expect(onApproval).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "承認" }));
    expect(onApproval).toHaveBeenCalledWith("n:5", true);
  });

  it("fails closed when an approval request has no reviewable details", () => {
    const onApproval = vi.fn();
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          title: "Thread A",
          status: "Approval",
          workingDirectory: "C:\\repo",
          events: [],
          approval: {
            id: "n:6",
            message: "Approval requested",
            kind: "command",
            canApprove: false,
          },
        }}
        onApproval={onApproval}
      />,
    );

    expect(screen.getByRole("button", { name: "承認" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "拒否" }));
    expect(onApproval).toHaveBeenCalledWith("n:6", false);
  });

  it("does not invent reasoning levels when the server advertises none", () => {
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          title: "Thread A",
          status: "Idle",
          workingDirectory: "",
          model: "dynamic",
          events: [],
        }}
        models={[{ id: "dynamic", label: "Dynamic" }]}
      />,
    );
    expect(screen.getByLabelText("推論レベル")).toHaveTextContent(
      "モデルの初期値",
    );
    expect(
      screen.getByLabelText("推論レベル").querySelectorAll("option"),
    ).toHaveLength(1);
  });

  it("keeps high-risk Codex controls explicit and user-selected", () => {
    const onSandboxModeChange = vi.fn();
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          title: "Thread A",
          status: "Idle",
          workingDirectory: "",
          events: [],
        }}
        onSandboxModeChange={onSandboxModeChange}
      />,
    );

    fireEvent.click(screen.getByText("Codex設定"));
    expect(screen.getByLabelText("Thread A サンドボックス")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Thread A サンドボックス"), {
      target: { value: "danger-full-access" },
    });
    expect(onSandboxModeChange).toHaveBeenCalledWith("danger-full-access");
  });

  it("supports same-turn steering while retaining an explicit stop control", () => {
    const onSteer = vi.fn();
    const onStop = vi.fn();
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          title: "Thread A",
          status: "Running",
          workingDirectory: "C:\\repo",
          events: [],
        }}
        onSteer={onSteer}
        onStop={onStop}
      />,
    );

    fireEvent.change(screen.getByLabelText("メッセージ"), {
      target: { value: "失敗中のテストを先に確認して" },
    });
    fireEvent.click(screen.getByRole("button", { name: /追加入力/ }));
    expect(onSteer).toHaveBeenCalledWith("失敗中のテストを先に確認して");
    expect(screen.getByRole("button", { name: /停止/ })).toBeVisible();
  });

  it("starts a standard code review and keeps PR creation confirmation-gated", () => {
    const onStartReview = vi.fn();
    const onPreparePullRequest = vi.fn();
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          title: "Thread A",
          status: "Idle",
          workingDirectory: "C:\\repo",
          events: [],
        }}
        onStartReview={onStartReview}
        onPreparePullRequest={onPreparePullRequest}
      />,
    );

    fireEvent.click(screen.getByText("コード作業"));
    fireEvent.click(screen.getByRole("button", { name: /レビュー開始/ }));
    expect(onStartReview).toHaveBeenCalledWith({
      type: "uncommittedChanges",
    });
    fireEvent.click(screen.getByRole("button", { name: /PR準備/ }));
    expect(onPreparePullRequest).toHaveBeenCalledOnce();
    expect(screen.getByText(/pushとPR作成は結果確認後/)).toBeVisible();
  });

  it("supports pointer drag and keyboard reordering from an explicit handle", () => {
    const onDragStart = vi.fn();
    const onMove = vi.fn();
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          title: "ビルド確認",
          status: "Idle",
          workingDirectory: "",
          events: [],
        }}
        onDragStart={onDragStart}
        onMove={onMove}
      />,
    );

    const handle = screen.getByRole("button", {
      name: /ビルド確認をドラッグして並べ替え/,
    });
    fireEvent.dragStart(handle, {
      dataTransfer: { effectAllowed: "none", setData: vi.fn() },
    });
    expect(onDragStart).toHaveBeenCalledOnce();
    fireEvent.keyDown(handle, { key: "ArrowRight", altKey: true });
    expect(onMove).toHaveBeenCalledWith(1);
  });

  it("keeps the newest streamed event aligned at the bottom", () => {
    const pane = {
      id: "pane-a",
      title: "Streaming",
      status: "Running" as const,
      workingDirectory: "",
      events: [],
    };
    const { container, rerender } = render(<AgentPane pane={pane} />);
    const timeline = container.querySelector(".timeline") as HTMLDivElement;
    Object.defineProperty(timeline, "scrollHeight", {
      configurable: true,
      value: 480,
    });
    timeline.scrollTop = 0;

    rerender(
      <AgentPane
        pane={{
          ...pane,
          events: [
            {
              id: "assistant-1",
              kind: "assistant",
              title: "Codex",
              detail: "最新のメッセージ",
            },
          ],
        }}
      />,
    );

    expect(timeline.scrollTop).toBe(480);
  });

  it("switches between Enter and modifier-based sending without breaking IME", () => {
    const onSend = vi.fn();
    const pane = {
      id: "pane-a",
      title: "Input",
      status: "Idle" as const,
      workingDirectory: "",
      events: [],
    };
    const { rerender } = render(
      <AgentPane pane={pane} sendMode="enter" onSend={onSend} />,
    );
    const input = screen.getByLabelText("メッセージ");
    fireEvent.change(input, { target: { value: "Enterで送信" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Enterで送信");

    fireEvent.change(input, { target: { value: "変換確定" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(onSend).toHaveBeenCalledTimes(1);

    rerender(
      <AgentPane pane={pane} sendMode="modifier-enter" onSend={onSend} />,
    );
    fireEvent.change(input, { target: { value: "修飾キーで送信" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(onSend).toHaveBeenLastCalledWith("修飾キーで送信");
  });

  it("places controls below a three-line composer and grows to ten lines before scrolling", () => {
    const onSend = vi.fn();
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          title: "Compact composer",
          status: "Idle",
          workingDirectory: "C:\\repo",
          events: [],
        }}
        models={[{ id: "dynamic", label: "Dynamic" }]}
        onSend={onSend}
      />,
    );

    const input = screen.getByLabelText("メッセージ") as HTMLTextAreaElement;
    const composer = input.closest(".composer");
    const model = screen.getByLabelText("モデル");
    const reasoning = screen.getByLabelText("推論レベル");
    expect(input.rows).toBe(3);
    expect(composer).toContainElement(model);
    expect(composer).toContainElement(reasoning);
    expect(
      input.compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      input.compareDocumentPosition(reasoning) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(composer).toContainElement(
      screen.getByRole("button", { name: "Codex設定" }),
    );

    let scrollHeight = 420;
    Object.defineProperty(input, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    fireEvent.change(input, {
      target: {
        value: Array.from({ length: 14 }, (_, index) => index).join("\n"),
      },
    });
    const cappedHeight = Number.parseFloat(input.style.height);
    expect(cappedHeight).toBeGreaterThanOrEqual(180);
    expect(cappedHeight).toBeLessThanOrEqual(190);
    expect(input.style.overflowY).toBe("auto");

    scrollHeight = 36;
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(onSend).toHaveBeenCalledOnce();
    expect(input).toHaveValue("");
    expect(Number.parseFloat(input.style.height)).toBeGreaterThanOrEqual(54);
    expect(Number.parseFloat(input.style.height)).toBeLessThan(cappedHeight);
    expect(input.style.overflowY).toBe("hidden");
  });

  it("edits and saves the user-facing chat title", async () => {
    const onTitleChange = vi.fn().mockResolvedValue(undefined);
    render(
      <AgentPane
        pane={{
          id: "pane-a",
          threadId: "thread-a",
          title: "旧タイトル",
          status: "Idle",
          workingDirectory: "",
          events: [],
        }}
        titleValue="旧タイトル"
        onTitleChange={onTitleChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "旧タイトルのタイトルを編集" }),
    );
    fireEvent.change(screen.getByLabelText("チャットタイトル"), {
      target: { value: "新しいタイトル" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(onTitleChange).toHaveBeenCalledWith("新しいタイトル"),
    );
  });
});
