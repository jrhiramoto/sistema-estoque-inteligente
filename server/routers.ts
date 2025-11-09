import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

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
  }),

  // Produtos
  products: router({
    list: protectedProcedure
      .input(z.object({
        abcClass: z.enum(["A", "B", "C"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        if (input?.abcClass) {
          return await db.getProductsByABCClass(input.abcClass);
        }
        return await db.getAllProducts();
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
