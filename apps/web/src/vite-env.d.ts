/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ── App ────────────────────────────────────────────────────────────────────
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;

  // ── LIFF (real) ────────────────────────────────────────────────────────────
  /** LINE LIFF ID — required in production, ignored when VITE_LIFF_MOCK=true */
  readonly VITE_LIFF_ID: string;

  // ── LIFF mock (local development) ─────────────────────────────────────────
  /**
   * Set to "true" to use MockLiffAdapter instead of the real @line/liff SDK.
   * All other VITE_LIFF_MOCK_* vars are only effective when this is "true".
   */
  readonly VITE_LIFF_MOCK: string;
  /** "false" to start the mock session in a logged-out state (default: "true") */
  readonly VITE_LIFF_MOCK_LOGGED_IN: string;
  /** Fake LINE userId for the mock session */
  readonly VITE_LIFF_MOCK_USER_ID: string;
  /** Fake display name shown in the UI */
  readonly VITE_LIFF_MOCK_DISPLAY_NAME: string;
  /** URL of the fake avatar image */
  readonly VITE_LIFF_MOCK_PICTURE_URL: string;
  /** Artificial init delay in ms (simulates real SDK latency, default: 400) */
  readonly VITE_LIFF_MOCK_INIT_DELAY_MS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
