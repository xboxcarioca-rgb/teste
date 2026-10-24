O enquadramento A2/A3/A4 confirmado no upload é a fonte única para o PNG final; não reenquadrar pelo Alpha depois de aplicar a retícula, pois isso perde o zoom e o recorte escolhidos.A limpeza de exportação do motor (DTFCleanPngCanvas) só pode descartar sujeira mínima; nunca manter apenas o maior bloco, pois textos e elementos separados são arte.

- Library file classification lives in a browser-safe helper and uses file/ancestor names for halftone labels and Drive image dimensions at 300 DPI before explicit paper labels; ratios alone cannot distinguish A-series sizes.
- Folder covers rotate only while visible, preload before replacement, and select cached image candidates through the authenticated Drive endpoint with validated descendant paths; this avoids blank covers and preserves library access boundaries.
- Payment subscriptions map to the custom `user_access` identity through `access_subscriptions`, not Auth users; the product uses email-and-code access rather than managed authentication.
- PIX prices are one-time payments that extend custom access by 30 days or 365 days; only card prices create renewable subscriptions.
- Keep payment product definitions in `src/lib/payment-catalog.ts` and validate provider prices server-side, so UI, checkout, and entitlements cannot drift.
- Route every plan purchase through the single verified public payments webhook; standalone service sales must never grant plan access.
- Bridge the custom email-and-code identity into managed OAuth only after a successful access-code validation; MCP tools then authorize by the verified token email and RLS.
- Payment webhook events remain retryable until entitlement processing completes; email delivery is best-effort and never rolls back a paid entitlement.
- Device limits use durable per-device session rows shared by browser and desktop activation; IP addresses are audit signals only.
