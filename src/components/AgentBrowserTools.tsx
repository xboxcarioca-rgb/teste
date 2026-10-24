import { useWebMCP } from "use-webmcp-tool";
import { pricingOptions } from "@/components/landing/data";

export function AgentBrowserTools() {
  useWebMCP({
    name: "read_current_page",
    description: "Read the title and address of the DTFLEXPRO page currently open in this tab.",
    annotations: { readOnlyHint: true },
    execute: () => ({ content: [{ type: "text", text: `Página atual: ${document.title}\nEndereço: ${window.location.pathname}${window.location.search}` }] }),
  });

  useWebMCP({
    name: "read_available_plans",
    description: "Read the DTFLEXPRO plans currently presented in the app without starting a purchase.",
    annotations: { readOnlyHint: true },
    execute: () => ({ content: [{ type: "text", text: pricingOptions.map((plan) => `${plan.label}: ${plan.price}${plan.cadence}`).join("\n") }] }),
  });

  return null;
}