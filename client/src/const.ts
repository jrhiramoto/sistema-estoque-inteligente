export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Sistema de Gestão de Estoque Inteligente";

export const APP_LOGO = "https://placehold.co/128x128/3B82F6/FFFFFF?text=SE";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

// Frequências de contagem para inventário cíclico
export const COUNT_FREQUENCIES = {
  weekly: { label: "Semanal", days: 7 },
  biweekly: { label: "Quinzenal", days: 14 },
  monthly: { label: "Mensal", days: 30 },
  quarterly: { label: "Trimestral", days: 90 },
  biannual: { label: "Semestral", days: 180 },
  annual: { label: "Anual", days: 365 },
} as const;

// Tipos de alerta
export const ALERT_TYPES = {
  low_stock: { label: "Estoque Baixo", color: "amber" },
  reorder_needed: { label: "Reposição Necessária", color: "orange" },
  excess_stock: { label: "Estoque Excessivo", color: "blue" },
  inventory_variance: { label: "Divergência de Inventário", color: "red" },
  negative_stock: { label: "Estoque Negativo", color: "red" },
  recount_needed: { label: "Recontagem Necessária", color: "yellow" },
} as const;

// Severidades de alerta
export const ALERT_SEVERITIES = {
  low: { label: "Baixa", color: "blue" },
  medium: { label: "Média", color: "yellow" },
  high: { label: "Alta", color: "orange" },
  critical: { label: "Crítica", color: "red" },
} as const;

// Classes ABC
export const ABC_CLASSES = {
  A: {
    label: "Classe A",
    description: "80% do faturamento - Prioridade máxima",
    color: "green",
    countFrequency: "monthly",
  },
  B: {
    label: "Classe B",
    description: "15% do faturamento - Prioridade média",
    color: "blue",
    countFrequency: "quarterly",
  },
  C: {
    label: "Classe C",
    description: "5% do faturamento - Prioridade baixa",
    color: "gray",
    countFrequency: "biannual",
  },
} as const;
