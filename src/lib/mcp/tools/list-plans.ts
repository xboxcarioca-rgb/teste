import { defineTool } from "@lovable.dev/mcp-js";

const plans = [
  { id: "mensal", name: "Plano Mensal", price: "R$ 47", period: "mês", card: "renovável", pix: "30 dias" },
  { id: "anual", name: "Plano Anual", price: "R$ 147", period: "ano", card: "renovável", pix: "365 dias" },
];

export default defineTool({
  name: "list_plans",
  title: "Listar planos",
  description: "Lista os planos oficiais DTFLEXPRO e as modalidades cartão e PIX.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => ({
    content: [{ type: "text", text: plans.map((plan) => `${plan.name}: ${plan.price}/${plan.period}; cartão ${plan.card}; PIX dá ${plan.pix} de acesso.`).join("\n") }],
    structuredContent: { plans },
  }),
});