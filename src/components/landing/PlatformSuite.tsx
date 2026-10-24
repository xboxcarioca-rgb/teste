import {
  BarChart3,
  Boxes,
  Calculator,
  FileStack,
  FolderSearch2,
  ImageIcon,
  Palette,
} from "lucide-react";

import { Card } from "@/components/ui/card";

const platformTools = [
  {
    icon: Palette,
    title: "Halftone inteligente",
    description:
      "Prepare artes para tecidos pretos, brancos ou qualquer cor. O motor calcula contraste, underbase e retícula sem apagar olhos, cabelos, roupas, sombras, textos e detalhes internos.",
  },
  {
    icon: FolderSearch2,
    title: "Biblioteca de artes",
    description:
      "Encontre arquivos em pastas com capas, busca e categorias automáticas. Envie uma arte da biblioteca diretamente para o Halftone sem baixar e subir novamente.",
  },
  {
    icon: BarChart3,
    title: "Gestão DTF",
    description:
      "Controle produção, pedidos, clientes, estoque, financeiro, impostos, relatórios e usuários. Cada conta começa zerada e mantém suas próprias informações.",
  },
  {
    icon: FileStack,
    title: "Montagem DTF profissional",
    description:
      "Organize várias artes em folhas de 58 × 100 cm ou tamanho livre, com medidas reais, distribuição automática e exportação em PNG ou PDF a 300 DPI.",
  },
  {
    icon: ImageIcon,
    title: "Estúdio de mockups",
    description:
      "Monte apresentações em camisas masculinas, femininas, infantis e dobradas, ajuste frente ou costas, altere a cor do tecido e use seu próprio fundo.",
  },
  {
    icon: Boxes,
    title: "Fluxo completo em um só lugar",
    description:
      "Importe PNG, JPEG, PDF ou PSD, use imagens por link, prepare a impressão, organize seus arquivos e acompanhe o negócio sem sair da plataforma.",
  },
  {
    icon: Calculator,
    title: "Calculadora DTF",
    description:
      "Calcule medidas e custos da produção com rapidez para preparar orçamentos e tomar decisões sem sair da área de ferramentas.",
  },
] as const;

export function PlatformSuite() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 max-w-4xl space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-brand">Plataforma completa</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Da biblioteca de artes à gestão da sua produção DTF
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            Crie, organize, prepare, apresente e gerencie seus trabalhos com ferramentas conectadas
            pelo mesmo acesso.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {platformTools.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="rounded-lg border-border/70 bg-card/55 p-6 backdrop-blur">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-brand/30 bg-brand-muted text-brand">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-medium">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
