// filepath: apps/web/src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional override for the API base URL.
   *
   * Default is the empty string so all `/api/*` requests hit the **same
   * origin** that served the SPA. This is what we want now that the Hono
   * API and the React SPA are served from a single Cloudflare Worker.
   *
   * Override only when you need to point the dev SPA at a remote API
   * (for example, staging UI → prod API while debugging).
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}