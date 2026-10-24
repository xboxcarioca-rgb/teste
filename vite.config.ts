// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      // Permite o host de preview do ambiente (E2B/Arena) além do domínio do app.
      allowedHosts: [".e2b.app", "dtflexpro.com", ".dtflexpro.com"],
    },
    preview: {
      allowedHosts: [".e2b.app", "dtflexpro.com", ".dtflexpro.com"],
    },
  },
});
