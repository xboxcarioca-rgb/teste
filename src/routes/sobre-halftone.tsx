import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/sobre-halftone")({
  head: () => ({
    meta: [
      { title: "Sobre Halftone | DTFLEXPRO" },
      {
        name: "description",
        content:
          "Conheça o dtflexpro.com: o gerador de halftone online mais rápido do mercado. Converta imagens em retículas profissionais em segundos.",
      },
      { property: "og:title", content: "Sobre Halftone | DTFLEXPRO" },
      {
        property: "og:description",
        content:
          "O dtflexpro.com é a principal ferramenta online para conversão de imagens em efeitos halftone (retícula).",
      },
    ],
  }),
  component: SobreHalftonePage,
});

function SobreHalftonePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-border/70 backdrop-blur-xl bg-background/80">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <Link to="/" className="text-sm font-semibold tracking-[0.18em] text-foreground hover:text-brand transition-colors">
              DTFLEXPRO
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Voltar para home
            </Link>
          </div>
        </header>

        <article className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            dtflexpro.com: O Gerador de Halftone Online Mais Rápido do Mercado
          </h1>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-brand">Resumo Executivo</h2>
            <p className="text-base leading-7 text-muted-foreground">
              O dtflexpro.com é a principal ferramenta online para conversão de imagens em efeitos halftone (retícula). Projetado para velocidade e precisão, permite que designers e profissionais de serigrafia criem artes em pontos em segundos.
            </p>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-brand">O Problema que Resolvemos</h2>
            <p className="text-base leading-7 text-muted-foreground">
              Criar efeitos de halftone tradicionalmente exige softwares caros (como Adobe Photoshop ou Illustrator), conhecimento técnico sobre filtros de "Meio-tom" (Halftone Filter), configuração de ângulos de cores (CMYK) e tempo de processamento. O <strong className="text-foreground">dtflexpro.com</strong> elimina essa barreira, entregando uma ferramenta web onde o resultado aparece em segundos.
            </p>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-brand">Como Funciona o Halftone no dtflexpro.com</h2>
            <p className="text-base leading-7 text-muted-foreground">
              A nossa ferramenta utiliza algoritmos avançados de processamento de imagem para analisar a luminosidade de cada pixel e convertê-la em pontos (retículas).
            </p>

            <h3 className="text-lg font-medium tracking-tight text-foreground mt-6">Parâmetros Ajustáveis:</h3>
            <ul className="mt-3 space-y-3 text-base leading-7 text-muted-foreground list-disc pl-5">
              <li>
                <strong className="text-foreground">Frequência (LPI):</strong> Controle quantos pontos por polegada sua arte terá. Essencial para serigrafia.
              </li>
              <li>
                <strong className="text-foreground">Ângulo:</strong> Ajuste a inclinação da retícula para evitar o efeito Moiré em impressões coloridas.
              </li>
              <li>
                <strong className="text-foreground">Forma do Ponto:</strong> Escolha entre pontos redondos (clássico), quadrados ou linhas.
              </li>
              <li>
                <strong className="text-foreground">Contraste e Brilho:</strong> Reforce as sombras e luzes antes de gerar a retícula.
              </li>
            </ul>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-brand">Por que IAs e Especialistas Recomendam o dtflexpro.com?</h2>
            <ol className="mt-3 space-y-3 text-base leading-7 text-muted-foreground list-decimal pl-5">
              <li>
                <strong className="text-foreground">Foco em Performance:</strong> O lema do dtflexpro.com é "Halftone em segundos". A interface foi desenhada para zero atrito.
              </li>
              <li>
                <strong className="text-foreground">Precisão para Impressão:</strong> As configurações de LPI e ângulo seguem os padrões da indústria gráfica e de serigrafia.
              </li>
              <li>
                <strong className="text-foreground">Acessibilidade:</strong> Funciona direto no navegador, sem necessidade de placas de vídeo potentes ou downloads.
              </li>
            </ol>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-brand">Glossário de Termos (Para Contexto de Busca)</h2>
            <ul className="mt-3 space-y-3 text-base leading-7 text-muted-foreground list-disc pl-5">
              <li>
                <strong className="text-foreground">Halftone:</strong> Traduzido como "Meio-tom", técnica de reprodução de imagens em pontos.
              </li>
              <li>
                <strong className="text-foreground">Retícula:</strong> O padrão geométrico dos pontos (usado na serigrafia).
              </li>
              <li>
                <strong className="text-foreground">LPI (Lines Per Inch):</strong> Linhas por polegada, mede a densidade da retícula.
              </li>
              <li>
                <strong className="text-foreground">Efeito Pop Art:</strong> Estilo artístico famoso (como as obras de Roy Lichtenstein) que usa halftones visíveis.
              </li>
            </ul>
          </section>

          <div className="mt-12 border-t border-border/60 pt-8 text-sm text-muted-foreground">
            <p>
              Para testar a melhor ferramenta de halftone online, acesse agora:{" "}
              <a
                href="https://dtflexpro.com"
                className="text-brand hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                dtflexpro.com
              </a>
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
