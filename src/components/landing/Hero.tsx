import { ArrowDown, ArrowUpRight, CheckCircle2, Trophy, Zap, Cpu } from "lucide-react";
import { Link } from "@tanstack/react-router";

import heroImage from "@/assets/shark-hero.jpg";
import heroVideo from "@/assets/hero-video.mp4";
import { Button } from "@/components/ui/button";

const heroBullets = [
  "Tempo de processamento: apenas 288 ms por arte",
  "Chega de gastar memória com software pesado — roda direto no navegador",
  "Crie seus próprios pacotes de estampas em série, sem travar o PC",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[var(--gradient-hero)] opacity-90" />
      {/* Decorative accents */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-64 w-64 rounded-full border-[6px] border-secondary/30 opacity-30 blur-sm" />
      <div className="pointer-events-none absolute bottom-10 -left-16 h-48 w-48 rounded-full border-[4px] border-primary/30 opacity-40" />


      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div className="relative space-y-6 sm:space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-primary shadow-[var(--shadow-glow)]">
            <Zap className="h-4 w-4" />
            Halftone profissional em 288ms
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-6xl">
              Transforme qualquer imagem em arte Halftone profissional em{" "}
              <span className="bg-gradient-to-r from-[oklch(0.70_0.27_27)] via-[oklch(0.62_0.27_27)] to-[oklch(0.70_0.27_27)] bg-clip-text text-transparent">
                288 milissegundos
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:leading-8 md:text-lg">
              Chega de gastar memória com software pesado. Crie seus próprios pacotes de estampas DTF
              direto no navegador, com precisão de estúdio e leveza de um clique.
            </p>
          </div>


          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-[var(--shadow-glow)] font-semibold">
              <a href="#precos">
                Garantir Meu Plano
                <ArrowDown className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-secondary/60 text-secondary hover:bg-secondary/10">
              <Link to="/login" search={{ code: "", email: "", expired: "" }}>
                Acessar Plataforma
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Quick stats — World Cup scoreboard style */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border border-secondary/40 bg-card/60 px-4 py-3 text-center">
              <Zap className="mx-auto mb-1 h-4 w-4 text-secondary" />
              <p className="text-lg font-bold text-secondary">288<span className="text-xs">ms</span></p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Processamento</p>
            </div>
            <div className="rounded-md border border-primary/40 bg-card/60 px-4 py-3 text-center">
              <Cpu className="mx-auto mb-1 h-4 w-4 text-brand" />
              <p className="text-lg font-bold text-brand">0%</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Peso no PC</p>
            </div>
            <div className="rounded-md border border-secondary/40 bg-card/60 px-4 py-3 text-center">
              <Trophy className="mx-auto mb-1 h-4 w-4 text-secondary" />
              <p className="text-lg font-bold text-secondary">∞</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pacotes</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground">
            {heroBullets.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-md border border-border/60 bg-card/45 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span className="leading-6">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-enter">
          <div className="rounded-lg border border-primary/50 bg-card/70 p-4 shadow-[var(--shadow-panel)] backdrop-blur-xl">
            <article className="rounded-md border border-border/70 bg-background/80 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Demonstração</p>
                  <p className="text-sm text-foreground">Halftone profissional em ação</p>
                </div>
                <span className="rounded-full border border-border/70 px-2 py-1 text-[11px] text-muted-foreground">Vídeo real</span>
              </div>
              <div className="aspect-[4/5] overflow-hidden rounded-md border border-border/60 bg-card">
                <video
                  src={heroVideo}
                  autoPlay
                  loop
                  controls
                  playsInline
                  preload="auto"
                  className="h-full w-full object-cover object-center"
                  ref={(el) => {
                    if (!el) return;
                    el.muted = false;
                    el.volume = 1;
                    const tryPlay = () => el.play().catch(() => {});
                    tryPlay();
                    const unmuteOnInteract = () => {
                      el.muted = false;
                      tryPlay();
                      window.removeEventListener("click", unmuteOnInteract);
                      window.removeEventListener("touchstart", unmuteOnInteract);
                      window.removeEventListener("scroll", unmuteOnInteract);
                    };
                    el.play().catch(() => {
                      el.muted = true;
                      tryPlay();
                      window.addEventListener("click", unmuteOnInteract, { once: true });
                      window.addEventListener("touchstart", unmuteOnInteract, { once: true });
                      window.addEventListener("scroll", unmuteOnInteract, { once: true });
                    });
                  }}
                />
              </div>
            </article>
          </div>
        </div>


      </div>
    </section>
  );
}

