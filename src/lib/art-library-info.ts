export type ArtFileInfo = {
  name: string;
  imageMediaMetadata?: { width?: number; height?: number };
};

const paperPixels = [
  { format: "A2", width: 4961, height: 7016 },
  { format: "A3", width: 3508, height: 4961 },
  { format: "A4", width: 2480, height: 3508 },
] as const;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isHalftoneArt(name: string, folderNames: string[] = []) {
  return [name, ...folderNames].some((value) =>
    /half[\s_-]*tone|reticulad[ao]|reticula(?:\b|s\b)/.test(normalize(value)),
  );
}

export function detectArtPaper(item: ArtFileInfo, folderNames: string[] = []) {
  const width = item.imageMediaMetadata?.width;
  const height = item.imageMediaMetadata?.height;
  if (width && height) {
    const shorter = Math.min(width, height);
    const longer = Math.max(width, height);
    const match = paperPixels.find((paper) =>
      Math.abs(shorter - paper.width) <= 2 && Math.abs(longer - paper.height) <= 2,
    );
    if (match) return { format: match.format, source: "dimensions" as const };
  }
  // A-series ratios alone cannot distinguish A2, A3 and A4.
  for (const value of [item.name, ...folderNames.slice().reverse()]) {
    const match = normalize(value).match(/(?:^|[^a-z0-9])a[\s_-]?([234])(?=$|[^a-z0-9])/);
    if (match) return { format: `A${match[1]}`, source: "name" as const };
  }
  return null;
}