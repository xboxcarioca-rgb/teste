import { createFileRoute } from "@tanstack/react-router";
import { verifyAdminPassword } from "@/lib/access.functions";

export const Route = createFileRoute("/verify-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { password?: string };
          await verifyAdminPassword({ data: { password: body.password ?? "" } });
          return Response.json({ ok: true });
        } catch {
          return Response.json({ message: "Credenciais inválidas" }, { status: 401 });
        }
      },
    },
  },
});