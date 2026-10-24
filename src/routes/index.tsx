import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DTFLEXPRO | Ferramenta Halftone DTF online" },
      {
        name: "description",
        content:
          "Use a ferramenta base de halftone direto na página inicial: envie sua arte, ajuste a retícula para qualquer cor de tecido e exporte PNG A2, A3 ou A4 em 300 DPI, pronto para DTF.",
      },
      { property: "og:title", content: "DTFLEXPRO | Ferramenta Halftone DTF online" },
      {
        property: "og:description",
        content:
          "Halftone profissional direto no navegador, na própria página inicial — e a plataforma completa com Biblioteca, Gestão DTF, montagem e mockups no seu acesso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://www.dtflexpro.com" }],
  }),
  component: LandingPage,
});
