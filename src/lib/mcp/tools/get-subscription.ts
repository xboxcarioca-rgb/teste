import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_subscription",
  title: "Consultar assinatura",
  description: "Consulta a assinatura mais recente e a próxima data de renovação da pessoa conectada.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserEmail()) throw new ToolError("Conecte sua conta DTFLEXPRO primeiro.");
    const db = supabaseForUser(ctx);
    const { data: access } = await db.from("user_access")
      .select("status, expires_at")
      .eq("email", ctx.getUserEmail() ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!access || access.status !== "active" || (access.expires_at && new Date(access.expires_at).getTime() <= Date.now())) {
      throw new ToolError("Seu acesso DTFLEXPRO não está ativo.");
    }
    const { data, error } = await db.from("access_subscriptions")
      .select("price_id, status, current_period_end, cancel_at_period_end, scheduled_price_id, environment")
      .eq("email", ctx.getUserEmail() ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ToolError("Não foi possível consultar a assinatura agora.");
    if (!data) return { content: [{ type: "text", text: "Nenhuma assinatura renovável foi encontrada. Compras por PIX são acessos avulsos." }] };
    const subscription = {
      priceId: data.price_id,
      status: data.status,
      currentPeriodEnd: data.current_period_end,
      cancelsAtPeriodEnd: data.cancel_at_period_end,
      scheduledPriceId: data.scheduled_price_id,
      environment: data.environment,
    };
    return {
      content: [{ type: "text", text: `Assinatura ${subscription.status}; período atual até ${subscription.currentPeriodEnd ?? "data não informada"}.` }],
      structuredContent: { subscription },
    };
  },
});