import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Users, MessageCircle, Shirt, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrialSignupDialog } from "@/components/landing/TrialSignupDialog";
import logo from "@/assets/dtflexpro-logo.png.asset.json";

export function Header({ affiliateMode = false }: { affiliateMode?: boolean } = {}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <Link
          to="/"
          className="inline-flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <img
            src={logo.url}
            alt="DTFlexPRO"
            className="h-auto w-28 object-contain sm:w-44 md:w-56"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="size-11 sm:h-9 sm:w-auto sm:px-3"
            onClick={() =>
              document.getElementById("estudio")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <Shirt className="h-4 w-4" />
            <span className="hidden sm:inline">Crie seu mockup</span>
          </Button>

          <Button
            asChild
            size="icon"
            className="size-11 bg-[#25D366] text-white shadow-[0_0_18px_#25D36680] hover:bg-[#1ebe57] sm:h-9 sm:w-auto sm:px-3"
          >
            <a
              href="https://chat.whatsapp.com/D8RHqGnmh0bBkMoPCcAkBY"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Entre no nosso grupo</span>
            </a>
          </Button>
          {!affiliateMode && (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                <Link to="/afiliado">
                  <Users className="h-4 w-4" />
                  Afiliados
                </Link>
              </Button>
              <TrialSignupDialog
                trigger={
                  <Button size="icon" className="size-11 sm:h-9 sm:w-auto sm:px-3">
                    <Gift className="h-4 w-4" />
                    <span className="hidden sm:inline">Teste grátis 7 dias</span>
                  </Button>
                }
              />
            </>
          )}
          <Button asChild variant="outline" size="icon" className="size-11 sm:h-9 sm:w-auto sm:px-3">
            <Link to="/login" search={{ code: "", email: "", expired: "" }}>
              <span className="hidden sm:inline">Acessar</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
