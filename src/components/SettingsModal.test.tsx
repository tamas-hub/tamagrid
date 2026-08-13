import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { I18nProvider, type AppLanguage } from "../i18n";
import { SettingsModal } from "./index";
import type { ComposerSendMode } from "./types";

function LanguageHarness() {
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [sendMode, setSendMode] = useState<ComposerSendMode>("modifier-enter");
  return (
    <I18nProvider language={language}>
      <SettingsModal
        open
        codexPath=""
        language={language}
        sendMode={sendMode}
        onClose={() => undefined}
        onChooseExecutable={() => undefined}
        onAutoDetect={() => undefined}
        onTestConnection={() => undefined}
        onRefreshModels={() => undefined}
        onLanguageChange={setLanguage}
        onSendModeChange={setSendMode}
      />
    </I18nProvider>
  );
}

describe("SettingsModal language", () => {
  it("defaults to English and switches the complete surface with EN / JP", () => {
    render(<LanguageHarness />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "EN — English" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "JP — 日本語" }));
    expect(screen.getByRole("heading", { name: "設定" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "EN — English" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Display language" }),
    ).toBeVisible();
    expect(
      screen.getByText(/Applied to interface text and date formatting/),
    ).toBeVisible();
    const enterMode = screen.getByRole("button", {
      name: "Enter to send",
    });
    fireEvent.click(enterMode);
    expect(enterMode).toHaveAttribute("aria-pressed", "true");
  });
});
