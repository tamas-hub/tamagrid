import { describe, expect, it } from "vitest";
import type { CodexModel } from "../codex";
import {
  createDefaultPanes,
  loadWorkspace,
  normalizeFontScale,
  reconcileModels,
  reorderPanes,
} from "./workspace";

function model(id: string, isDefault = false): CodexModel {
  return {
    id,
    model: id,
    displayName: id,
    description: "",
    hidden: false,
    isDefault,
    defaultReasoningEffort: "advertised-effort",
    supportedReasoningEfforts: [
      { reasoningEffort: "advertised-effort", description: "" },
    ],
  };
}

describe("model reconciliation", () => {
  it("does not replace a removed saved model with a similarly named model", () => {
    const panes = createDefaultPanes();
    panes[0] = {
      ...panes[0],
      model: "generation-1-sol",
      reasoning: "advertised-effort",
    };
    const reconciled = reconcileModels(panes, [
      model("generation-2-sol", true),
    ]);

    expect(reconciled[0].model).toBeUndefined();
    expect(reconciled[0].reasoning).toBeUndefined();
    expect(reconciled[0].unavailableModel).toBe("generation-1-sol");
  });

  it("restores only the exact same model id when it becomes available again", () => {
    const panes = createDefaultPanes();
    panes[0] = { ...panes[0], unavailableModel: "exact-model" };
    const reconciled = reconcileModels(panes, [model("exact-model")]);

    expect(reconciled[0].model).toBe("exact-model");
    expect(reconciled[0].unavailableModel).toBeUndefined();
  });

  it("leaves an unspecified selection to the App Server default", () => {
    const reconciled = reconcileModels(createDefaultPanes(), [
      model("server-default", true),
    ]);
    expect(reconciled.every((pane) => pane.model === undefined)).toBe(true);
  });

  it("drops fine-grained options no longer advertised by the selected model", () => {
    const panes = createDefaultPanes();
    panes[0] = {
      ...panes[0],
      model: "dynamic",
      reasoning: "removed-effort",
      serviceTier: "removed-tier",
      personality: "friendly",
    };
    const dynamic = model("dynamic");
    dynamic.supportsPersonality = false;
    dynamic.serviceTiers = [];

    const reconciled = reconcileModels(panes, [dynamic]);
    expect(reconciled[0].reasoning).toBeUndefined();
    expect(reconciled[0].serviceTier).toBeUndefined();
    expect(reconciled[0].personality).toBeUndefined();
  });
});

describe("font scale normalization", () => {
  it("keeps supported steps and clamps unsafe persisted values", () => {
    expect(normalizeFontScale(1.14)).toBe(1.1);
    expect(normalizeFontScale(1.16)).toBe(1.2);
    expect(normalizeFontScale(0.1)).toBe(0.9);
    expect(normalizeFontScale(1.5)).toBe(1.5);
    expect(normalizeFontScale(2)).toBe(2);
    expect(normalizeFontScale(4)).toBe(2);
    expect(normalizeFontScale("large")).toBe(1);
  });
});

describe("pane defaults", () => {
  it("provides four stable panes for every four-pane layout", () => {
    const panes = createDefaultPanes();
    expect(panes.map((pane) => pane.id)).toEqual([
      "pane-left",
      "pane-right",
      "pane-bottom-left",
      "pane-bottom-right",
    ]);
    expect(panes.every((pane) => pane.title === "")).toBe(true);
  });

  it("migrates a saved two-pane workspace without losing its threads", () => {
    window.localStorage.setItem(
      "tamagrid.workspace.v1",
      JSON.stringify({
        version: 1,
        executablePath: "C:\\codex.exe",
        selectedPaneId: "pane-right",
        fontScale: 1.3,
        layout: "vertical-2",
        panes: [
          {
            id: "pane-left",
            title: "Thread A",
            workingDirectory: "C:\\left",
            threadId: "thread-left",
          },
          {
            id: "pane-right",
            title: "Thread B",
            workingDirectory: "C:\\right",
            threadId: "thread-right",
          },
        ],
      }),
    );

    const workspace = loadWorkspace();
    expect(workspace.layout).toBe("split-2");
    expect(workspace.theme).toBe("aurora");
    expect(workspace.language).toBe("en");
    expect(workspace.panes).toHaveLength(4);
    expect(workspace.panes[0].threadId).toBe("thread-left");
    expect(workspace.panes[1].threadId).toBe("thread-right");
    window.localStorage.clear();
  });

  it("migrates AgentDeck preview state to the TamaGrid storage key", () => {
    window.localStorage.setItem(
      "agentdeck.workspace.v1",
      JSON.stringify({
        version: 5,
        executablePath: "C:\\codex.exe",
        selectedPaneId: "pane-left",
        fontScale: 1.5,
        layout: "grid-4",
        theme: "green",
        language: "ja",
        sendMode: "modifier-enter",
        panes: [
          {
            id: "pane-left",
            title: "移行するチャット",
            workingDirectory: "C:\\workspace",
            threadId: "legacy-thread",
          },
        ],
      }),
    );

    const workspace = loadWorkspace();

    expect(workspace.panes[0].threadId).toBe("legacy-thread");
    expect(workspace.fontScale).toBe(1.5);
    expect(window.localStorage.getItem("tamagrid.workspace.v1")).not.toBeNull();
    window.localStorage.clear();
  });

  it("restores a saved background theme and rejects unknown values", () => {
    window.localStorage.setItem(
      "tamagrid.workspace.v1",
      JSON.stringify({
        version: 3,
        executablePath: "",
        selectedPaneId: "pane-left",
        fontScale: 1,
        layout: "grid-4",
        theme: "green",
        panes: [{ id: "pane-left", title: "Thread A", workingDirectory: "" }],
      }),
    );
    expect(loadWorkspace().theme).toBe("green");

    const stored = JSON.parse(
      window.localStorage.getItem("tamagrid.workspace.v1") ?? "{}",
    );
    stored.theme = "unknown";
    window.localStorage.setItem(
      "tamagrid.workspace.v1",
      JSON.stringify(stored),
    );
    expect(loadWorkspace().theme).toBe("aurora");
    window.localStorage.clear();
  });

  it("restores language and pane order while removing legacy A-D labels", () => {
    window.localStorage.setItem(
      "tamagrid.workspace.v1",
      JSON.stringify({
        version: 4,
        executablePath: "",
        selectedPaneId: "pane-right",
        fontScale: 1,
        layout: "grid-4",
        theme: "dark",
        language: "en",
        panes: [
          { id: "pane-right", title: "Release checks", workingDirectory: "" },
          { id: "pane-left", title: "Thread A", workingDirectory: "" },
        ],
      }),
    );

    const workspace = loadWorkspace();
    expect(workspace.language).toBe("en");
    expect(workspace.sendMode).toBe("modifier-enter");
    expect(workspace.panes[0].id).toBe("pane-right");
    expect(workspace.panes[0].title).toBe("Release checks");
    expect(workspace.panes[1].title).toBe("");
    window.localStorage.clear();
  });

  it("restores the selected message send shortcut", () => {
    window.localStorage.setItem(
      "tamagrid.workspace.v1",
      JSON.stringify({
        version: 5,
        executablePath: "",
        selectedPaneId: "pane-left",
        fontScale: 2,
        layout: "split-2",
        theme: "aurora",
        language: "ja",
        sendMode: "enter",
        panes: [{ id: "pane-left", title: "", workingDirectory: "" }],
      }),
    );

    const workspace = loadWorkspace();
    expect(workspace.sendMode).toBe("enter");
    expect(workspace.fontScale).toBe(2);
    window.localStorage.clear();
  });

  it("does not restore approval-free or system-wide authority", () => {
    window.localStorage.setItem(
      "tamagrid.workspace.v1",
      JSON.stringify({
        version: 5,
        executablePath: "C:\\untrusted\\codex.exe",
        selectedPaneId: "pane-left",
        fontScale: 1,
        layout: "split-2",
        theme: "dark",
        language: "en",
        sendMode: "modifier-enter",
        panes: [
          {
            id: "pane-left",
            title: "Security migration",
            workingDirectory: "C:\\workspace",
            approvalPolicy: "never",
            sandboxMode: "danger-full-access",
          },
        ],
      }),
    );

    const workspace = loadWorkspace();
    expect(workspace.panes[0].approvalPolicy).toBeUndefined();
    expect(workspace.panes[0].sandboxMode).toBeUndefined();
    expect("executablePath" in workspace).toBe(false);
    window.localStorage.clear();
  });

  it("reorders complete pane state without changing pane identities", () => {
    const panes = createDefaultPanes().map((pane, index) => ({
      ...pane,
      title: `Chat ${index + 1}`,
    }));
    const reordered = reorderPanes(panes, "pane-left", "pane-bottom-left");
    expect(reordered.map((pane) => pane.title)).toEqual([
      "Chat 2",
      "Chat 3",
      "Chat 1",
      "Chat 4",
    ]);
  });
});
