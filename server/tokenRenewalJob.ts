/**
 * Job de Renovação Automática de Token do Bling
 * 
 * Executa a cada 6 horas e renova o token se ele expira em menos de 24 horas
 */

import * as db from "./db";
import { TRPCError } from "@trpc/server";

/**
 * Renova o token do Bling usando refresh_token
 */
async function renewBlingToken(userId: number): Promise<boolean> {
  try {
    const config = await db.getBlingConfig(userId);
    if (!config || !config.refreshToken) {
      console.error("[Token Renewal] Configuração ou refresh token não encontrado");
      return false;
    }

    console.log("[Token Renewal] Renovando token do Bling...");

    const response = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Token Renewal] Erro ao renovar token:", errorText);
      return false;
    }

    const data: {
      access_token: string;
      expires_in: number;
      refresh_token: string;
    } = await response.json();

    // Calcular data de expiração
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Atualizar configuração
    await db.upsertBlingConfig({
      userId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: expiresAt,
    });

    console.log(`[Token Renewal] ✅ Token renovado com sucesso! Expira em: ${expiresAt.toLocaleString('pt-BR')}`);
    return true;

  } catch (error: any) {
    console.error("[Token Renewal] ❌ Erro ao renovar token:", error.message);
    return false;
  }
}

/**
 * Verifica se o token precisa ser renovado e renova se necessário
 */
export async function checkAndRenewToken(userId: number = 1): Promise<void> {
  try {
    const config = await db.getBlingConfig(userId);
    if (!config || !config.accessToken) {
      console.log("[Token Renewal] Sem configuração do Bling, pulando verificação");
      return;
    }

    const now = new Date();
    const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt) : new Date(0);
    const hoursRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));

    console.log(`[Token Renewal] Token expira em ${hoursRemaining}h (${expiresAt.toLocaleString('pt-BR')})`);

    // Renovar se expira em menos de 24 horas
    if (hoursRemaining < 24) {
      console.log("[Token Renewal] ⚠️ Token expira em menos de 24h, renovando...");
      const success = await renewBlingToken(userId);
      
      if (!success) {
        console.error("[Token Renewal] ❌ Falha ao renovar token automaticamente");
        // TODO: Enviar notificação para o owner
      }
    } else {
      console.log("[Token Renewal] ✅ Token ainda válido, nenhuma ação necessária");
    }

  } catch (error: any) {
    console.error("[Token Renewal] ❌ Erro ao verificar token:", error.message);
  }
}

/**
 * Inicia o job de renovação automática
 * Executa a cada 6 horas
 */
export function startTokenRenewalJob(): void {
  console.log("[Token Renewal] 🚀 Iniciando job de renovação automática (a cada 6 horas)");
  
  // Executar imediatamente na inicialização
  checkAndRenewToken().catch(console.error);
  
  // Executar a cada 6 horas
  setInterval(() => {
    checkAndRenewToken().catch(console.error);
  }, 6 * 60 * 60 * 1000); // 6 horas em ms
}
