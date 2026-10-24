import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ZIP portátil: navegadores e o SmartScreen não bloqueiam .zip como fazem com .exe
const FILE = "DTFLEXPRO-Studio-win64.zip";

// Download público do software desktop (Windows x64)
export const Route = createFileRoute("/api/public/download-windows")({
  server: {
    handlers: {
      GET: async () => {
        // URL assinada longa: o navegador baixa direto do storage (sem passar
        // pelo servidor), o que deixa o download bem mais rápido.
        const { data, error } = await supabaseAdmin.storage
          .from("downloads")
          .createSignedUrl(FILE, 60 * 60 * 6, { download: FILE });
        if (error || !data?.signedUrl) {
          return new Response("Download indisponível no momento.", { status: 503 });
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: data.signedUrl,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
      },
    },
  },
});
