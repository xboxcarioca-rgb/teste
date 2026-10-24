import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  prompt: z.string().min(2).max(2000),
});

export const generateImageFromPrompt = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const { assertAccessAuthenticated } = await import("./access-guard.server");
    await assertAccessAuthenticated();
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        prompt: data.prompt,
        size: "1024x1024",
        n: 1,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Servidor ocupado. Tente novamente em alguns segundos.");
      if (res.status === 402) throw new Error("Servidor temporariamente indisponível. Tente novamente em instantes.");
      throw new Error(`Falha na geração. Tente novamente. (${res.status}) ${txt.slice(0, 120)}`);
    }

    const json: any = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
      // fallback shape (chat-completions)
      const url = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (url) return { dataUrl: url as string };
      throw new Error("Sem imagem retornada");
    }
    return { dataUrl: `data:image/png;base64,${b64}` };
  });
