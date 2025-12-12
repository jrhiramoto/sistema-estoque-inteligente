// TEMPORÁRIO: Fallback para JWT_SECRET (mesmo do auth.ts)
const FALLBACK_JWT_SECRET = 'a78ab949198597689777d06c84656aff2d2ebb3b708b74b858fbe9244223653fb73361b6e281341f9afba36f27b01fa051031d12c490eff75c5ebd6ac7254059';

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET || FALLBACK_JWT_SECRET,
  jwtSecret: process.env.JWT_SECRET || FALLBACK_JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
