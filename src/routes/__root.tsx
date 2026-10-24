import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você tentou acessar não está disponível.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para a home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "DTFLEXPRO" },
      {
        name: "description",
        content: "DTFLEXPRO com landing pública, checkout integrado, login por código e painel administrativo protegido.",
      },
      { property: "og:title", content: "DTFLEXPRO" },
      {
        property: "og:description",
        content: "Checkout, liberação por código e painel administrativo seguro em uma operação única.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "DTFLEXPRO" },
      { name: "description", content: "Para quem é o dtflexpro.com? Profissionais de DTF (halftone) que precisam preparar artes com retículas (LPI) perfeitas para tirar o efeito plastificado." },
      { property: "og:description", content: "Para quem é o dtflexpro.com? Profissionais de DTF (halftone) que precisam preparar artes com retículas (LPI) perfeitas para tirar o efeito plastificado." },
      { name: "twitter:description", content: "Para quem é o dtflexpro.com? Profissionais de DTF (halftone) que precisam preparar artes com retículas (LPI) perfeitas para tirar o efeito plastificado." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/HqcOtKknNuVBb6VR55JOqjij9vw1/social-images/social-1782385388593-ChatGPT_Image_25_de_jun._de_2026,_08_02_36.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/HqcOtKknNuVBb6VR55JOqjij9vw1/social-images/social-1782385388593-ChatGPT_Image_25_de_jun._de_2026,_08_02_36.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        {/* Anti-print / anti-captura global — não altera layout */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print { html, body { display: none !important; visibility: hidden !important; background: #000 !important; } }
              html, body { -webkit-touch-callout: none; }
              img, video, canvas { -webkit-user-drag: none; user-select: none; }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var block = function(e){ e.preventDefault(); };
                  document.addEventListener('contextmenu', block);
                  document.addEventListener('dragstart', block);
                  document.addEventListener('copy', function(e){
                    var t = e.target; var tag = (t && t.tagName) || '';
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
                    if (t && t.closest && t.closest('[data-allow-copy]')) return;
                    e.preventDefault();
                  });
                  document.addEventListener('keydown', function(e){
                    var k = e.key;
                    if (k === 'PrintScreen') { try{navigator.clipboard.writeText('')}catch(_){}; e.preventDefault(); return; }
                    if (k === 'F12') { e.preventDefault(); return; }
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','I','j','J','c','C'].indexOf(k) !== -1) { e.preventDefault(); return; }
                    if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 'P' || k === 's' || k === 'S' || k === 'u' || k === 'U')) { e.preventDefault(); return; }
                  }, true);
                  window.addEventListener('beforeprint', function(){ document.body.style.visibility='hidden'; });
                  window.addEventListener('afterprint', function(){ document.body.style.visibility=''; });
                } catch(_) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-right" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
