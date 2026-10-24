import { createFileRoute } from "@tanstack/react-router";
import { validateAccessCode } from "@/lib/access.functions";

export const Route = createFileRoute("/validate-access-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { email?: string; code?: string };
          const result = await validateAccessCode({
            data: {
              email: body.email ?? "",
              code: body.code ?? "",
            },
          });

          if (!result.ok) {
            return Response.json({ message: result.error }, { status: 400 });
          }

          return Response.json(result);
        } catch {
          return Response.json({ message: "Código inválido ou expirado" }, { status: 400 });
        }
      },
    },
  },
});