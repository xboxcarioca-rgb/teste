import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const ShirtStudioCanvas = lazy(() => import("./shirt-studio/ShirtStudioCanvas"));

function StudioSkeleton() {
  return (
    <div className="mx-auto aspect-[297/420] w-full max-w-[420px] animate-pulse rounded-lg border border-border bg-card/50 sm:max-w-none sm:aspect-auto sm:h-[560px]" />
  );
}

export function ShirtStudio() {
  return (
    <section id="estudio" className="mx-auto w-full max-w-6xl px-3 py-14 sm:px-4 sm:py-20">
      <div className="mb-10 text-center">
        <span className="inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Novo · Estúdio de personalização
        </span>
        <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
          Monte sua camisa online
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Escolha modelos masculinos, femininos, infantis ou camisa dobrada, defina a cor e o lado
          da peça, posicione a arte sem ultrapassar o mockup e use uma imagem própria como fundo.
        </p>
      </div>
      <ClientOnly fallback={<StudioSkeleton />}>
        <Suspense fallback={<StudioSkeleton />}>
          <ShirtStudioCanvas />
        </Suspense>
      </ClientOnly>
    </section>
  );
}
