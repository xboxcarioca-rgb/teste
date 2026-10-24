import { createFileRoute, redirect } from "@tanstack/react-router";
import { lookupAffiliateBySlug } from "@/lib/affiliate.functions";
import { LandingPage } from "@/components/LandingPage";

// Reserved paths handled by other routes — anything else is treated as an affiliate slug
const RESERVED = new Set([
  "admin", "app", "login", "afiliado", "afiliados", "api", "auth",
  "logout", "register", "signup", "checkout", "dashboard", "painel",
  "lovable", "validate-access-code", "verify-admin", "r",
  "favicon.ico", "robots.txt", "sitemap.xml",
]);

export const Route = createFileRoute("/$slug")({
  beforeLoad: async ({ params }) => {
    const s = params.slug.toLowerCase();
    if (RESERVED.has(s) || s.includes(".")) {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ params }) => {
    const res = await lookupAffiliateBySlug({ data: { slug: params.slug } });
    if (!res.found) {
      throw redirect({ to: "/" });
    }
    return res;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `DTFLEXPRO | Indicado por ${loaderData?.fullName ?? ""}` },
      { name: "description", content: "Halftone profissional para DTF — indicação de afiliado." },
    ],
  }),
  component: AffiliateLanding,
  errorComponent: () => <LandingPage />,
  notFoundComponent: () => <LandingPage />,
});

function AffiliateLanding() {
  const data = Route.useLoaderData();
  return (
    <div
      style={{
        ["--brand" as any]: "oklch(0.58 0.25 27)",
        ["--brand-foreground" as any]: "oklch(0.99 0 0)",
        ["--brand-muted" as any]: "oklch(0.58 0.25 27 / 0.20)",
        ["--primary" as any]: "oklch(0.58 0.25 27)",
        ["--primary-foreground" as any]: "oklch(0.99 0 0)",
        ["--ring" as any]: "oklch(0.58 0.25 27)",
      }}
    >
      <LandingPage affiliateMode affiliateWhatsapp={data?.found ? data.whatsapp : null} />
    </div>
  );
}
