// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Hosts extras liberados para o proxy de preview (Arena/E2B) e domínio próprio.
const EXTRA_ALLOWED_HOSTS = [".e2b.app", "dtflexpro.com", ".dtflexpro.com"];

export default defineConfig({
  vite: {
    plugins: [mcpPlugin()],
    server: { allowedHosts: EXTRA_ALLOWED_HOSTS },
    preview: { allowedHosts: EXTRA_ALLOWED_HOSTS },
  },
});
