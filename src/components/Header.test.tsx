import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./index";
import { I18nProvider } from "../i18n";

describe("Header", () => {
  it("shows remaining Codex usage and exposes font scaling controls", () => {
    const onFontScaleChange = vi.fn();
    const onLayoutChange = vi.fn();
    const onThemeChange = vi.fn();
    const { container } = render(
      <Header
        connected
        usage={{
          currentLabel: "Codex",
          current: { usedPercent: 34, remainingPercent: 66 },
          buckets: [],
        }}
        fontScale={1}
        onFontScaleChange={onFontScaleChange}
        onHistory={vi.fn()}
        onLayoutChange={onLayoutChange}
        onThemeChange={onThemeChange}
      />,
    );

    const controlRail = container.querySelector(".ad-header-control-rail");
    const statusRail = container.querySelector(".ad-header-status-rail");
    const historyButton = screen.getByRole("button", {
      name: "過去の履歴を開く",
    });
    expect(controlRail?.firstElementChild).toBe(statusRail);
    expect(statusRail?.nextElementSibling).toBe(historyButton);
    expect(
      screen.getByRole("button", { name: /Codex残り使用量 66%/ }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "文字を大きくする" }));
    expect(onFontScaleChange).toHaveBeenCalledWith(1.1);
    fireEvent.change(screen.getByLabelText("ペインレイアウト"), {
      target: { value: "grid-4" },
    });
    expect(onLayoutChange).toHaveBeenCalledWith("grid-4");
    fireEvent.change(screen.getByLabelText("背景テーマ"), {
      target: { value: "green" },
    });
    expect(onThemeChange).toHaveBeenCalledWith("green");
  });

  it("renders the same controls in English", () => {
    render(
      <I18nProvider language="en">
        <Header connected onLayoutChange={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByLabelText("Pane layout")).toHaveTextContent("4 panes");
    expect(screen.getByRole("group", { name: "Font size" })).toBeVisible();
  });
});
