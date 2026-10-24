import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getAccountAccessTool from "./tools/get-account-access";
import getSubscriptionTool from "./tools/get-subscription";
import listPlansTool from "./tools/list-plans";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "halftonedtflexpro",
  title: "HalftoneDTFLEXPRO",
  version: "0.1.0",
  instructions: "Ferramentas protegidas para consultar planos, acesso e assinatura DTFLEXPRO. As permissões da conta continuam valendo.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listPlansTool, getAccountAccessTool, getSubscriptionTool],
});