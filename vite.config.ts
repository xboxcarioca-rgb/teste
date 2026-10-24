// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// allowedHosts: ajuste de desenvolvimento (importacao 24/out/2026) para o
// dev server aceitar hosts de preview/sandbox alem de localhost.
export default defineConfig({
  vite: {
    plugins: [mcpPlugin()],
    server: { allowedHosts: true },
    preview: { allowedHosts: true },
  },
});
