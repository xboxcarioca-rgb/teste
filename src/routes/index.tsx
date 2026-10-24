import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DTFLEXPRO | Halftone profissional em segundos" },
      {
        name: "description",
        content:
          "Crie halftone profissional, organize artes, monte arquivos DTF, faça mockups e gerencie sua produção em uma plataforma completa.",
      },
      { property: "og:title", content: "DTFLEXPRO | Halftone profissional em segundos" },
      {
        property: "og:description",
        content:
          "Halftone para qualquer cor de tecido, Biblioteca de Artes, Gestão DTF, montagem profissional e mockups em uma só plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://www.dtflexpro.com" }],
  }),
  component: LandingPage,
});
