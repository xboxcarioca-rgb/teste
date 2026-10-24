import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

type Props = { trigger: React.ReactNode };

export function DTFCalculatorDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [largura, setLargura] = useState("10");
  const [altura, setAltura] = useState("10");
  const [precoCm2, setPrecoCm2] = useState("0.10");
  const [qtd, setQtd] = useState("1");
  const [margem, setMargem] = useState("30");

  const calc = useMemo(() => {
    const L = parseFloat(largura) || 0;
    const A = parseFloat(altura) || 0;
    const p = parseFloat(precoCm2) || 0;
    const q = parseInt(qtd) || 0;
    const m = parseFloat(margem) || 0;
    const area = L * A;
    const custoUnit = area * p;
    const custoTotal = custoUnit * q;
    const venda = custoTotal * (1 + m / 100);
    const lucro = venda - custoTotal;
    return { area, custoUnit, custoTotal, venda, lucro };
  }, [largura, altura, precoCm2, qtd, margem]);

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Calculadora DTF</DialogTitle>
          <DialogDescription>Calcule o custo e o preço de venda da sua estampa em DTF.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Largura (cm)</Label>
            <Input type="number" inputMode="decimal" value={largura} onChange={(e) => setLargura(e.target.value)} />
          </div>
          <div>
            <Label>Altura (cm)</Label>
            <Input type="number" inputMode="decimal" value={altura} onChange={(e) => setAltura(e.target.value)} />
          </div>
          <div>
            <Label>Preço por cm² (R$)</Label>
            <Input type="number" inputMode="decimal" step="0.01" value={precoCm2} onChange={(e) => setPrecoCm2(e.target.value)} />
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Margem de lucro (%)</Label>
            <Input type="number" inputMode="decimal" value={margem} onChange={(e) => setMargem(e.target.value)} />
          </div>
        </div>
        <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Área:</span><strong>{calc.area.toFixed(2)} cm²</strong></div>
          <div className="flex justify-between"><span>Custo unitário:</span><strong>{brl(calc.custoUnit)}</strong></div>
          <div className="flex justify-between"><span>Custo total:</span><strong>{brl(calc.custoTotal)}</strong></div>
          <div className="flex justify-between text-emerald-600"><span>Preço de venda:</span><strong>{brl(calc.venda)}</strong></div>
          <div className="flex justify-between text-primary"><span>Lucro:</span><strong>{brl(calc.lucro)}</strong></div>
        </div>
        <Button onClick={() => setOpen(false)} className="mt-2">Fechar</Button>
      </DialogContent>
    </Dialog>
  );
}
