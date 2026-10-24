import { getShirtSrc, type ShirtModel } from "@/components/landing/shirt-studio/ShirtMockup";

export type CatalogMockupInput = {
  art: File;
  artImage?: ImageBitmap;
  logo?: File | null;
  model: ShirtModel;
  color: string;
  brandName: string;
  watermarkText: string;
  watermark: boolean;
  watermarkColor: string;
  watermarkOpacity: number;
  printSize: number;
  position: "Peito" | "Centro" | "Costas";
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

const shirtImages = new Map<string, Promise<HTMLImageElement>>();
function loadShirt(src: string) {
  const cached = shirtImages.get(src);
  if (cached) return cached;
  const loading = loadImage(src).catch((error) => { shirtImages.delete(src); throw error; });
  shirtImages.set(src, loading);
  return loading;
}

export async function createCatalogMockup(input: CatalogMockupInput): Promise<Blob> {
  const size = 900;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível criar o mockup.");

  context.fillStyle = "#e8eaed";
  context.fillRect(0, 0, size, size);
  const shirt = await loadShirt(getShirtSrc(input.model, input.position === "Costas" ? "costas" : "frente"));
  const artUrl = input.artImage ? null : URL.createObjectURL(input.art);
  const logoUrl = input.logo ? URL.createObjectURL(input.logo) : null;

  try {
    const art = input.artImage ?? await loadImage(artUrl ?? "");
    const shirtScale = Math.min((size * 0.86) / shirt.width, (size * 0.92) / shirt.height);
    const shirtWidth = shirt.width * shirtScale;
    const shirtHeight = shirt.height * shirtScale;
    const shirtX = (size - shirtWidth) / 2;
    const shirtY = (size - shirtHeight) / 2;

    const shirtLayer = document.createElement("canvas");
    shirtLayer.width = size;
    shirtLayer.height = size;
    const shirtContext = shirtLayer.getContext("2d");
    if (!shirtContext) throw new Error("Não foi possível criar a camada da camiseta.");
    shirtContext.drawImage(shirt, shirtX, shirtY, shirtWidth, shirtHeight);
    shirtContext.globalCompositeOperation = "source-in";
    shirtContext.fillStyle = input.color;
    shirtContext.fillRect(0, 0, size, size);
    shirtContext.globalCompositeOperation = "multiply";
    shirtContext.drawImage(shirt, shirtX, shirtY, shirtWidth, shirtHeight);
    shirtContext.globalCompositeOperation = "destination-in";
    shirtContext.drawImage(shirt, shirtX, shirtY, shirtWidth, shirtHeight);
    context.drawImage(shirtLayer, 0, 0);

    const maxArtWidth = size * Math.min(0.52, Math.max(0.22, input.printSize / 70));
    const maxArtHeight = size * 0.42;
    const artScale = Math.min(maxArtWidth / art.width, maxArtHeight / art.height);
    const artWidth = art.width * artScale;
    const artHeight = art.height * artScale;
    const artX = (size - artWidth) / 2;
    const artY = input.position === "Peito" ? size * 0.3 : size * 0.34;

    context.save();
    context.beginPath();
    context.rect(shirtX, shirtY, shirtWidth, shirtHeight);
    context.clip();
    context.drawImage(art, artX, artY, artWidth, artHeight);
    context.restore();

    if (input.watermark && input.watermarkText.trim()) {
      context.save();
      context.globalAlpha = input.watermarkOpacity / 100;
      context.fillStyle = input.watermarkColor;
      context.font = "700 58px system-ui, sans-serif";
      context.textAlign = "center";
      context.translate(size / 2, size / 2);
      context.rotate(-Math.PI / 6);
      context.fillText(input.watermarkText.trim().slice(0, 28), 0, 0);
      context.restore();
    }

    if (logoUrl) {
      const logo = await loadImage(logoUrl);
      const maxWidth = 180;
      const maxHeight = 90;
      const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
      const width = logo.width * scale;
      const height = logo.height * scale;
      context.drawImage(logo, size - width - 28, size - height - 28, width, height);
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao salvar mockup."))), "image/jpeg", 0.8);
    });
  } finally {
    if (artUrl) URL.revokeObjectURL(artUrl);
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    canvas.width = 1;
    canvas.height = 1;
  }
}