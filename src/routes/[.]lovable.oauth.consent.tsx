import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Bot, Check, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type OAuthRedirect = { redirect_url: string };
type AuthorizationDetails = {
  authorization_id: string;
  redirect_uri: string;
  client: { name: string };
  user: { id: string; email: string };
  scope: string;
};
type AuthorizationResponse = AuthorizationDetails | OAuthRedirect;

function oauthApi() {
  return (supabase.auth as typeof supabase.auth & {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationResponse | null; error: Error | null }>;
      approveAuthorization: (id: string) => Promise<{ data: OAuthRedirect | null; error: Error | null }>;
      denyAuthorization: (id: string) => Promise<{ data: OAuthRedirect | null; error: Error | null }>;
    };
  }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search.authorization_id === "string" ? search.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Solicitação de conexão inválida.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { email: "", next } });
    }
  },
  loader: async () => {
    const authorizationId = new URL(window.location.href).searchParams.get("authorization_id");
    if (!authorizationId) throw new Error("Solicitação de conexão inválida.");
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    if (data && "redirect_url" in data) {
      window.location.href = data.redirect_url;
      return null;
    }
    return data as AuthorizationDetails | null;
  },
  head: () => ({ meta: [
    { title: "Conectar agente — DTFLEXPRO" },
    { name: "description", content: "Autorize um agente a consultar sua conta DTFLEXPRO." },
    { property: "og:title", content: "Conectar agente — DTFLEXPRO" },
    { property: "og:description", content: "Consentimento protegido para integrações de agentes DTFLEXPRO." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ConsentPage,
  errorComponent: ({ error }) => <ConsentError message={error instanceof Error ? error.message : "Não foi possível abrir esta conexão."} />,
});

function ConsentError({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-background px-6"><Card className="w-full max-w-lg p-8 text-center"><X className="mx-auto h-10 w-10 text-destructive" /><h1 className="mt-4 text-2xl font-semibold">Conexão indisponível</h1><p className="mt-2 text-muted-foreground">{message}</p></Card></main>;
}

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client.name ?? "Agente";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const result = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (result.error) { setBusy(false); setError(result.error.message); return; }
    const target = result.data?.redirect_url;
    if (!target) { setBusy(false); setError("A conexão não informou para onde retornar."); return; }
    window.location.href = target;
  }

  return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
    <Card className="w-full max-w-lg rounded-lg border-border bg-card p-8">
      <Bot className="h-10 w-10 text-primary" />
      <h1 className="mt-5 text-2xl font-semibold">Conectar {clientName} ao DTFLEXPRO</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{clientName} poderá chamar as ferramentas habilitadas usando sua conta.</p>
      <div className="mt-6 space-y-3 border-y border-border py-5 text-sm">
        <p className="flex gap-3"><Check className="h-5 w-5 text-primary" /> Consultar seu plano e validade do acesso</p>
        <p className="flex gap-3"><Check className="h-5 w-5 text-primary" /> Consultar sua assinatura e próxima renovação</p>
        <p className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary" /> As permissões e proteções da sua conta continuam valendo</p>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancelar conexão</Button>
        <Button disabled={busy} onClick={() => decide(true)}>{busy ? "Conectando…" : "Permitir conexão"}</Button>
      </div>
    </Card>
  </main>;
}