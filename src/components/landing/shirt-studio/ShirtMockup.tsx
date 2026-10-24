import carecaFrente from "@/assets/shirt-careca-frente.png";
import carecaCostas from "@/assets/shirt-careca-costas.png";
import vFrente from "@/assets/shirt-v-frente.png";
import regataFrente from "@/assets/shirt-regata-frente.png";
import regataCostas from "@/assets/shirt-regata-costas.png";
import poloFrente from "@/assets/shirt-polo-frente.png";
import mangaLongaFrente from "@/assets/shirt-manga-longa-frente.png";
import mangaLongaCostas from "@/assets/shirt-manga-longa-costas.png";
import moletomFemFrente from "@/assets/shirt-moletom-fem-frente.png";
import moletomFemCostas from "@/assets/shirt-moletom-fem-costas.png";
import babylookFrente from "@/assets/shirt-babylook-frente.png";
import babylookCostas from "@/assets/shirt-babylook-costas.png";
import infantilFrente from "@/assets/shirt-infantil-frente.png";
import infantilCostas from "@/assets/shirt-infantil-costas.png";
import lateral from "@/assets/shirt-lateral.png";
import dobrada from "@/assets/shirt-dobrada.png";

export type ShirtModel = "careca" | "v" | "regata" | "polo" | "manga-longa" | "baby-look" | "moletom-fem" | "infantil" | "dobrada";
export type ShirtSide = "frente" | "costas" | "lado-esq" | "lado-dir";

const SOURCES: Record<ShirtModel, Record<"frente" | "costas", string>> = {
  careca: { frente: carecaFrente, costas: carecaCostas },
  v: { frente: vFrente, costas: carecaCostas },
  regata: { frente: regataFrente, costas: regataCostas },
  polo: { frente: poloFrente, costas: carecaCostas },
  "manga-longa": { frente: mangaLongaFrente, costas: mangaLongaCostas },
  "baby-look": { frente: babylookFrente, costas: babylookCostas },
  "moletom-fem": { frente: moletomFemFrente, costas: moletomFemCostas },
  infantil: { frente: infantilFrente, costas: infantilCostas },
  dobrada: { frente: dobrada, costas: dobrada },
};

export function getShirtSrc(model: ShirtModel, side: ShirtSide) {
  if (model === "dobrada") return dobrada;
  if (side === "lado-esq" || side === "lado-dir") return lateral;
  return SOURCES[model][side];
}

interface Props {
  model: ShirtModel;
  side: ShirtSide;
  color: string;
}

/**
 * Realistic photo mockup: a solid color layer masked by the shirt silhouette,
 * with the original photo multiplied on top so folds/shadows stay realistic.
 */
export function ShirtMockup({ model, side, color }: Props) {
  const src = getShirtSrc(model, side);
  const flipped = side === "lado-dir";

  const maskStyle: React.CSSProperties = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    backgroundColor: color,
  };

  return (
    <div
      className="relative h-full w-full select-none [isolation:isolate]"
      style={{ transform: flipped ? "scaleX(-1)" : undefined }}
    >
      <div className="absolute inset-0" style={maskStyle} />
      <img
        src={src}
        alt={`Mockup camisa ${model} ${side}`}
        loading="lazy"
        width={1024}
        height={1448}
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ mixBlendMode: "multiply" }}
      />
    </div>
  );
}
