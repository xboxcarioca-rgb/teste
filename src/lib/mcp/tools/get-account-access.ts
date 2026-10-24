import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_account_access",
  title: "Consultar acesso",
  description: "Consulta o plano, estado e validade do acesso DTFLEXPRO da pessoa conectada.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserEmail()) throw new ToolError("Conecte sua conta DTFLEXPRO primeiro.");
    const db = supabaseForUser(ctx);
    const { data, error } = await db.from("user_access")
      .select("status, expires_at, plan_code, device_limit, is_trial")
      .eq("email", ctx.getUserEmail() ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ToolError("Não foi possível consultar o acesso agora.");
    if (!data) return { content: [{ type: "text", text: "Nenhum acesso DTFLEXPRO foi encontrado para esta conta." }] };
    if (data.status !== "active" || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) {
      throw new ToolError("Seu acesso DTFLEXPRO não está ativo. Renove ou fale com o suporte antes de usar a integração.");
    }
    const access = {
      status: data.status,
      plan: data.plan_code,
      expiresAt: data.expires_at,
      deviceLimit: data.device_limit,
      trial: data.is_trial,
    };
    return {
      content: [{ type: "text", text: `Acesso ${access.status}; plano ${access.plan ?? "não informado"}; validade ${access.expiresAt ?? "não informada"}.` }],
      structuredContent: { access },
    };
  },
});