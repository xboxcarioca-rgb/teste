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

/**
 * Alvo do deploy. O padrão (Cloudflare) continua igual; para a Netlify use:
 *
 *   DEPLOY_TARGET=netlify npm run build
 *
 * O preset `netlify` do Nitro gera `.netlify/functions-internal/` (server) e
 * `.netlify/static/` (assets), que é exatamente o que a Netlify espera quando
 * o diretório de publicação é `.netlify/static` e as funções são detectadas
 * automaticamente.
 */
const deployTarget = process.env.DEPLOY_TARGET ?? "cloudflare";
const isNetlify = deployTarget === "netlify";
const nitroOptions = isNetlify ? { preset: "netlify" as const } : undefined;

// O mcpPlugin (@lovable.dev/mcp-js) importa `cloudflare:workers`, que só existe no
// runtime da Cloudflare. Em outros alvos ele quebra o bundle, então fica de fora.
const plugins = isNetlify ? [] : [mcpPlugin()];

// As rotas MCP (src/lib/mcp, /mcp, /.well-known/…) fazem um import() dinâmico,
// protegido por try/catch, de `cloudflare:workers`. Fora da Cloudflare esse módulo
// não existe, então ele é externalizado em vez de resolvido no bundle.
const rollupOptions = isNetlify
  ? { external: ["cloudflare:workers"] }
  : undefined;

export default defineConfig({
  ...(nitroOptions ? { nitro: nitroOptions } : {}),
  vite: {
    plugins,
    ...(rollupOptions ? { build: { rollupOptions } } : {}),
    server: { allowedHosts: EXTRA_ALLOWED_HOSTS },
    preview: { allowedHosts: EXTRA_ALLOWED_HOSTS },
  },
});
