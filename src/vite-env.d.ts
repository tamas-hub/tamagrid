/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TAMAGRID_SOAK?: string;
  readonly VITE_TAMAGRID_SOAK_DURATION_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
