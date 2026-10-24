import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-6 border-t border-border/60 pt-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-foreground">DTFLEXPRO</p>
          <p className="mt-2 text-sm text-muted-foreground">Feito para criativos que exigem precisão.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link to="/" className="story-link">Termos de Uso</Link>
          <Link to="/" className="story-link">Política de Privacidade</Link>
        </div>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">© {new Date().getFullYear()} DTFLEXPRO. Todos os direitos reservados.</p>
    </footer>
  );
}
