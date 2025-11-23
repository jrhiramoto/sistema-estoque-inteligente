import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import * as blingService from "./blingService";
import * as syncManager from "./syncManager";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Configuração do Bling
  bling: router({
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      return await db.getBlingConfig(ctx.user.id);
    }),
    
    saveConfig: protectedProcedure
      .input(z.object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        accessToken: z.string().optional(),
        refreshToken: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertBlingConfig({
          userId: ctx.user.id,
          ...input,
          isActive: !!input.accessToken,
        });
        return { success: true };
      }),
    
    exchangeCode: protectedProcedure
      .input(z.object({
        code: z.string(),
        clientId: z.string(),
        clientSecret: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const tokenData = await blingService.exchangeCodeForToken(
            input.code,
            input.clientId,
            input.clientSecret
          );
          
          const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
          
          await db.upsertBlingConfig({
            userId: ctx.user.id,
            clientId: input.clientId,
            clientSecret: input.clientSecret,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: expiresAt,
            isActive: true,
            lastSync: new Date(),
          });
          
          return { success: true, message: "Autoriza\u00e7\u00e3o conclu\u00edda com sucesso!" };
        } catch (error: any) {
          throw new Error(error.message || "Erro ao trocar c\u00f3digo por token");
        }
      }),
    
    syncProducts: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncManager.executeSync(ctx.user.id, "products", "manual");
        return result;
      } catch (error: any) {
        throw new Error(error.message || "Erro ao sincronizar produtos");
      }
    }),
    
    syncInventory: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncManager.executeSync(ctx.user.id, "inventory", "manual");
        return result;
      } catch (error: any) {
        throw new Error(error.message || "Erro ao sincronizar estoque");
      }
    }),
    
    syncSales: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncManager.executeSync(ctx.user.id, "sales", "manual");
        return result;
      } catch (error: any) {
        throw new Error(error.message || "Erro ao sincronizar vendas");
      }
    }),
    
    syncAll: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncManager.executeSync(ctx.user.id, "full", "manual");
        
        await db.upsertBlingConfig({
          userId: ctx.user.id,
          lastSync: new Date(),
        });
        
        return result;
      } catch (error: any) {
        console.error("[syncAll] Erro:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || "Erro ao sincronizar dados",
          cause: error,
        });
      }
    }),
    
    // Status da sincronização
    getSyncStatus: protectedProcedure.query(async () => {
      return {
        isRunning: syncManager.isSyncRunning(),
        currentSync: syncManager.getCurrentSync(),
        queueSize: syncManager.getQueueSize(),
      };
    }),
    
    // Histórico de sincronizações
    getSyncHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getRecentSyncHistory(input?.limit || 20);
      }),
    
    // Configuração de sincronização automática
    getSyncConfig: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSyncConfig(ctx.user.id);
    }),
    
    saveSyncConfig: protectedProcedure
      .input(z.object({
        autoSyncEnabled: z.boolean(),
        syncFrequencyHours: z.number().min(1).max(168), // Mínimo 1h, máximo 1 semana
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertSyncConfig({
          userId: ctx.user.id,
          autoSyncEnabled: input.autoSyncEnabled,
          syncFrequencyHours: input.syncFrequencyHours,
        });
        
        // Reiniciar job agendado com nova configuração
        const { restartScheduledSync } = await import('./scheduledSync');
        await restartScheduledSync();
        
        return { success: true };
      }),
  }),

  // Produtos
  products: router({
    list: protectedProcedure
      .input(z.object({
        abcClass: z.enum(["A", "B", "C"]).optional(),
        search: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
      }).optional())
      .query(async ({ input }) => {
        const page = input?.page || 1;
        const limit = input?.limit || 50;
        const offset = (page - 1) * limit;
        
        return await db.getProductsPaginated({
          abcClass: input?.abcClass,
          search: input?.search,
          limit,
          offset,
        });
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductById(input.id);
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        minStock: z.number().optional(),
        maxStock: z.number().optional(),
        reorderPoint: z.number().optional(),
        safetyStock: z.number().optional(),
        shouldStock: z.boolean().optional(),
        abcClass: z.enum(["A", "B", "C"]).optional(),
        abcClassManual: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const product = await db.getProductById(id);
        if (!product) throw new Error("Produto não encontrado");
        
        await db.upsertProduct({
          ...product,
          ...updates,
        });
        return { success: true };
      }),
  }),

  // Estoque
  inventory: router({
    getByProduct: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInventoryByProduct(input.productId);
      }),
    
    getTotal: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTotalInventoryByProduct(input.productId);
      }),
  }),

  // Vendas
  sales: router({
    getByProduct: protectedProcedure
      .input(z.object({
        productId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getSalesByProduct(
          input.productId,
          input.startDate,
          input.endDate
        );
      }),
  }),

  // Alertas
  alerts: router({
    list: protectedProcedure.query(async () => {
      return await db.getActiveAlerts();
    }),
    
    getByProduct: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAlertsByProduct(input.productId);
      }),
    
    resolve: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markAlertResolved(input.alertId, ctx.user.id);
        return { success: true };
      }),
  }),

  // Inventário Cíclico
  inventoryCounts: router({
    getByProduct: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInventoryCountsByProduct(input.productId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        productId: z.number(),
        expectedQty: z.number(),
        countedQty: z.number(),
        countType: z.enum(["scheduled", "alert", "manual"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const variance = input.countedQty - input.expectedQty;
        
        await db.insertInventoryCount({
          productId: input.productId,
          userId: ctx.user.id,
          expectedQty: input.expectedQty,
          countedQty: input.countedQty,
          countType: input.countType,
          notes: input.notes ?? null,
          variance,
          countDate: new Date(),
        });
        
        // Atualizar estoque físico
        const inventory = await db.getInventoryByProduct(input.productId);
        if (inventory.length > 0) {
          await db.upsertInventory({
            productId: input.productId,
            physicalStock: input.countedQty,
            lastPhysicalCount: new Date(),
          });
        }
        
        // Criar alerta se houver divergência significativa
        if (Math.abs(variance) > 5) {
          await db.insertAlert({
            productId: input.productId,
            alertType: "inventory_variance",
            severity: Math.abs(variance) > 20 ? "high" : "medium",
            message: `Divergência de ${variance} unidades detectada na contagem física`,
            isRead: false,
            isResolved: false,
            resolvedAt: null,
            resolvedBy: null,
          });
        }
        
        return { success: true, variance };
      }),
    
    getDueSchedules: protectedProcedure.query(async () => {
      return await db.getDueCountSchedules();
    }),
  }),

  // Dashboard - Métricas gerais
  dashboard: router({
    overview: protectedProcedure.query(async () => {
      const products = await db.getAllProducts();
      const alerts = await db.getActiveAlerts();
      
      const abcDistribution = {
        A: products.filter(p => p.abcClass === "A").length,
        B: products.filter(p => p.abcClass === "B").length,
        C: products.filter(p => p.abcClass === "C").length,
      };
      
      const alertsBySeverity = {
        critical: alerts.filter(a => a.severity === "critical").length,
        high: alerts.filter(a => a.severity === "high").length,
        medium: alerts.filter(a => a.severity === "medium").length,
        low: alerts.filter(a => a.severity === "low").length,
      };
      
      return {
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        totalAlerts: alerts.length,
        abcDistribution,
        alertsBySeverity,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
