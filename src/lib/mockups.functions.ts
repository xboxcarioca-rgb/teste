import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  imageBase64: z.string().min(10),
  imageMime: z.string().min(3).max(50),
  shirtColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const MOCKUP_PROMPTS = [
  (color: string) =>
    `Create a photorealistic flat-lay mockup of a plain ${color} t-shirt seen from the FRONT, centered on a neutral background. Print the provided artwork on the chest area, centered horizontally, between collar and waist. CRITICAL RULES: preserve 100% of the original artwork colors, do NOT alter any text, do NOT change transparency, do NOT recolor or add effects to the art. Apply realistic fabric folds, soft natural shadows, and follow the shirt's perspective so the print looks naturally printed on cotton. High resolution, studio lighting.`,
  (color: string) =>
    `Create a photorealistic photo of a real person (model) wearing a ${color} t-shirt, upper body shot. Print the provided artwork on the chest of the shirt, centered, naturally following the body and fabric curvature. CRITICAL: keep 100% of artwork colors, do not modify text, do not alter transparency. Natural studio lighting, soft realistic shadows on fabric folds. High resolution.`,
  (color: string) =>
    `Create a photorealistic image of a stack of neatly folded ${color} t-shirts on a clean surface. The top shirt is folded in a way that shows the provided artwork printed on its visible front panel, naturally adapted to the fold and fabric texture. CRITICAL: preserve 100% original artwork colors, no text changes, no transparency changes. Realistic shadows and lighting. High resolution.`,
];

function colorName(hex: string): string {
  const map: Record<string, string> = {
    "#000000": "black",
    "#ffffff": "white",
    "#808080": "gray",
    "#1e3a8a": "navy blue",
    "#0f766e": "teal",
    "#dc2626": "red",
    "#ea580c": "orange",
    "#f59e0b": "mustard yellow",
    "#65a30d": "lime green",
    "#db2777": "pink",
    "#7c3aed": "purple",
    "#451a03": "dark brown",
  };
  return map[hex.toLowerCase()] ?? hex;
}

async function generateOne(prompt: string, dataUrl: string, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json: any = await res.json();
  // Try common shapes
  const msg = json?.choices?.[0]?.message;
  const images = msg?.images;
  if (Array.isArray(images) && images[0]?.image_url?.url) {
    return images[0].image_url.url as string;
  }
  // fallback: data[0].b64_json
  const b64 = json?.data?.[0]?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;
  throw new Error("Sem imagem retornada");
}

export const generateShirtMockups = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertAccessAuthenticated } = await import("./access-guard.server");
    await assertAccessAuthenticated();
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
    const dataUrl = `data:${data.imageMime};base64,${data.imageBase64}`;
    const color = colorName(data.shirtColor);
    const results = await Promise.all(
      MOCKUP_PROMPTS.map((fn) => generateOne(fn(color), dataUrl, apiKey)),
    );
    return {
      frontal: results[0],
      modelo: results[1],
      dobrado: results[2],
    };
  });
