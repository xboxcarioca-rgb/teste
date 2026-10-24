import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, MessageCircle, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublishedCatalog } from "@/lib/catalog.functions";

export const Route = createFileRoute("/catalogo/$token")({
  loader: ({ params }) => getPublishedCatalog({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const name = loaderData?.batch.name ?? "Catálogo indisponível";
    const description = loaderData
      ? `Confira ${loaderData.products.length} produtos no catálogo ${name}.`
      : "Este catálogo não está disponível.";
    return {
      meta: [
        { title: `${name} | DTFLEXPRO` },
        { name: "description", content: description },
        { property: "og:title", content: `${name} | DTFLEXPRO` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: CatalogUnavailable,
  component: PublishedCatalogPage,
});

function formatMoney(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PublishedCatalogPage() {
  const { batch, products } = Route.useLoaderData();
  const settings = batch.settings as Record<string, unknown>;
  const brandName = typeof settings.brandName === "string" && settings.brandName.trim()
    ? settings.brandName
    : "DTFLEXPRO";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-primary">Catálogo digital</p>
            <h1 className="truncate text-xl font-black sm:text-2xl">{brandName}</h1>
          </div>
          <span className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-bold">
            {products.length} produtos
          </span>
        </div>
      </header>

      <section className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-sm font-bold uppercase text-primary">{batch.category}</p>
          <h2 className="mt-2 max-w-4xl text-3xl font-black sm:text-5xl">{batch.name}</h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Escolha sua estampa, confira as opções e envie o código do produto no atendimento.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product: {
            code: string;
            name: string;
            description: string;
            mockup_url?: string;
            product_data: Record<string, unknown>;
          }) => {
            const data = product.product_data as Record<string, unknown>;
            const sizes = Array.isArray(data.sizes) ? data.sizes.join(", ") : "";
            const price = Number(data.salePrice) > 0 ? data.salePrice : data.price;
            const message = encodeURIComponent(`Olá! Tenho interesse no produto ${product.code} — ${product.name}.`);
            return (
              <article key={product.code} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="aspect-square bg-muted">
                  {product.mockup_url ? (
                    <img src={product.mockup_url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center"><Shirt className="size-12 text-muted-foreground" /></div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs font-black uppercase text-primary">{product.code}</p>
                  <h3 className="mt-1 text-lg font-black">{product.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{product.description}</p>
                  {sizes && <p className="mt-3 flex items-center gap-1 text-xs"><Check className="size-3 text-primary" /> Tamanhos: {sizes}</p>}
                  <p className="mt-4 text-xl font-black">{formatMoney(price)}</p>
                  <Button className="mt-4 h-11 w-full" asChild>
                    <a href={`https://wa.me/?text=${message}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" /> Tenho interesse
                    </a>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function CatalogUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-center text-foreground">
      <div>
        <Shirt className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-black">Catálogo indisponível</h1>
        <p className="mt-2 text-muted-foreground">O link pode ter expirado ou o catálogo ainda não foi publicado.</p>
        <Button className="mt-5" asChild><Link to="/">Conhecer a DTFLEXPRO</Link></Button>
      </div>
    </main>
  );
}