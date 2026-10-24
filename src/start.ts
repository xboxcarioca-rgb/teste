import { createStart, createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Security headers aplicados em toda resposta SSR / server route / server fn.
// Mantém o layout intacto — apenas endurece o browser contra XSS, clickjacking,
// sniffing de MIME, vazamento de referrer e captura por origens externas.
const securityHeaders = createMiddleware().server(async ({ next }) => {
  const csp = [
    "default-src 'self'",
    // React + Vite runtime + libs shadcn precisam de inline/eval.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https: data:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: data: blob:",
    // Ferramentas embutidas (photoroom, visioncortex, checkout infinitepay, etc.).
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https:",
    // Anti-clickjacking — substitui X-Frame-Options com granularidade moderna.
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const headers: Record<string, string> = {
    "content-security-policy": csp,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "SAMEORIGIN",
    "x-dns-prefetch-control": "off",
    "x-permitted-cross-domain-policies": "none",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-site",
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
    "permissions-policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=(self)",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()",
    ].join(", "),
  };
  for (const [k, v] of Object.entries(headers)) setResponseHeader(k, v);

  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
  functionMiddleware: [attachSupabaseAuth],
}));
