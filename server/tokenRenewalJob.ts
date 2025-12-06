/**
 * Job de Renovação Automática de Token do Bling
 * 
 * Executa a cada 2 horas e renova o token se ele expira em menos de 48 horas
 * Inclui retry automático e notificação ao administrador em caso de falha
 */

import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./_core/notification";

/**
 * Renova o token do Bling usando refresh_token
 * @param userId - ID do usuário
 * @param retryCount - Número de tentativas (para retry)
 */
async function renewBlingToken(userId: number, retryCount: number = 0): Promise<boolean> {
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
      console.error(`[Token Renewal] Erro ao renovar token (tentativa ${retryCount + 1}/3):`, errorText);
      
      // Retry com backoff exponencial (máximo 3 tentativas)
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`[Token Renewal] Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return renewBlingToken(userId, retryCount + 1);
      }
      
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
    console.error(`[Token Renewal] ❌ Erro ao renovar token (tentativa ${retryCount + 1}/3):`, error.message);
    
    // Retry com backoff exponencial
    if (retryCount < 2) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`[Token Renewal] Aguardando ${delay}ms antes de tentar novamente...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return renewBlingToken(userId, retryCount + 1);
    }
    
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

    // Renovar se expira em menos de 48 horas (mais preventivo)
    if (hoursRemaining < 48) {
      console.log(`[Token Renewal] ⚠️ Token expira em ${hoursRemaining}h, renovando preventivamente...`);
      const success = await renewBlingToken(userId);
      
      if (!success) {
        console.error("[Token Renewal] ❌ Falha ao renovar token após 3 tentativas");
        
        // Notificar administrador
        try {
          await notifyOwner({
            title: "⚠️ Token do Bling Expirado",
            content: `O token de acesso ao Bling expirou e não foi possível renová-lo automaticamente.\n\n` +
                     `Expira em: ${hoursRemaining}h (${expiresAt.toLocaleString('pt-BR')})\n\n` +
                     `Ação necessária: Acesse Configurações > Integração Bling e reautorize o acesso.\n\n` +
                     `Enquanto isso, as sincronizações automáticas estarão pausadas.`
          });
          console.log("[Token Renewal] 📧 Notificação enviada ao administrador");
        } catch (notifyError) {
          console.error("[Token Renewal] Erro ao enviar notificação:", notifyError);
        }
      }
    } else {
      console.log(`[Token Renewal] ✅ Token válido por mais ${hoursRemaining}h, nenhuma ação necessária`);
    }

  } catch (error: any) {
    console.error("[Token Renewal] ❌ Erro ao verificar token:", error.message);
  }
}

/**
 * Inicia o job de renovação automática
 * Executa a cada 2 horas (mais frequente para evitar expiração)
 */
export function startTokenRenewalJob(): void {
  console.log("[Token Renewal] 🚀 Iniciando job de renovação automática (a cada 2 horas)");
  console.log("[Token Renewal] 🔄 Renovação preventiva: quando expira em menos de 48h");
  console.log("[Token Renewal] 🔁 Retry automático: até 3 tentativas com backoff exponencial");
  console.log("[Token Renewal] 📧 Notificação: administrador será alertado em caso de falha");
  
  // Executar imediatamente na inicialização
  checkAndRenewToken().catch(console.error);
  
  // Executar a cada 2 horas (mais frequente)
  setInterval(() => {
    checkAndRenewToken().catch(console.error);
  }, 2 * 60 * 60 * 1000); // 2 horas em ms
}
