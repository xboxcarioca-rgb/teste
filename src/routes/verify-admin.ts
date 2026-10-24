import { createFileRoute } from "@tanstack/react-router";
import { verifyAdminPassword } from "@/lib/access.functions";

export const Route = createFileRoute("/verify-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { password?: string };
          const resultado = await verifyAdminPassword({ data: { password: body.password ?? "" } });

          // A server function devolve { ok: false } em vez de lançar. Sem esta
          // checagem, a rota respondia "ok: true" para QUALQUER senha.
          if (!resultado?.ok) {
            return Response.json(
              { ok: false, message: resultado?.error ?? "Credenciais inválidas" },
              { status: 401 },
            );
          }

          return Response.json({ ok: true });
        } catch {
          return Response.json({ message: "Credenciais inválidas" }, { status: 401 });
        }
      },
    },
  },
});
