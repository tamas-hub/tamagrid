import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import packageMetadata from "../../package.json";
import { I18nProvider, type AppLanguage } from "../i18n";
import { SettingsModal } from "./index";
import type { ComposerSendMode } from "./types";

function LanguageHarness() {
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [sendMode, setSendMode] = useState<ComposerSendMode>("modifier-enter");
  const [fontScale, setFontScale] = useState(1);
  return (
    <I18nProvider language={language}>
      <SettingsModal
        open
        codexPath=""
        language={language}
        sendMode={sendMode}
        fontScale={fontScale}
        onClose={() => undefined}
        onChooseExecutable={() => undefined}
        onAutoDetect={() => undefined}
        onTestConnection={() => undefined}
        onRefreshModels={() => undefined}
        onLanguageChange={setLanguage}
        onSendModeChange={setSendMode}
        onFontScaleChange={setFontScale}
      />
    </I18nProvider>
  );
}

describe("SettingsModal language", () => {
  it("defaults to English and switches the complete surface with EN / JP", () => {
    render(<LanguageHarness />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(screen.getByText(packageMetadata.version)).toBeVisible();
    const statusRail = screen.getByLabelText(
      "Application and connection status",
    );
    expect(statusRail).toHaveClass("connection-details");
    expect(
      screen.getByRole("radiogroup", { name: "Display language" }),
    ).toHaveClass("connection-language-options");
    expect(
      screen.getByRole("button", { name: "EN — English" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "JP — 日本語" }));
    expect(screen.getByRole("heading", { name: "設定" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "EN — English" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Display language" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Increase font size" }));
    expect(screen.getByText("110%")).toBeVisible();
    const enterMode = screen.getByRole("button", {
      name: "Enter to send",
    });
    fireEvent.click(enterMode);
    expect(enterMode).toHaveAttribute("aria-pressed", "true");
  });
});
