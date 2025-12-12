import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import * as blingService from "./blingService";
import * as syncManager from "./syncManager";
import { webhookRouter } from "./webhookRouter";
import { authRouter } from "./authRouter";
import { userRouter } from "./userRouter";

export const appRouter = router({
  system: systemRouter,
  webhook: webhookRouter,
  users: userRouter,
  
  // Utilitários de debug
  debug: router({
    resetDbConnection: protectedProcedure.mutation(() => {
      db.resetDbConnection();
      return { success: true, message: "Conexão resetada com sucesso" };
    }),
    testDb: publicProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      }
      const result = await database.execute('SELECT 1 as test');
      return { success: true, result: result.rows };
    }),
    stats: protectedProcedure.query(async () => {
      return await db.getDataStats();
    }),
  }),
  
  // Sistema de autenticação híbrido (Google OAuth + Email/Senha)
  auth: authRouter,

  // Configuração do Bling
  bling: router({
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      let config = await db.getBlingConfig(ctx.user.id);
      
      // Se não existir, criar com valores padrão
      if (!config) {
        await db.upsertBlingConfig({
          userId: ctx.user.id,
          clientId: null,
          clientSecret: null,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isActive: false,
        });
        config = await db.getBlingConfig(ctx.user.id);
      }
      
      return config;
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
          // Primeiro salvar as credenciais
          await db.upsertBlingConfig({
            userId: ctx.user.id,
            clientId: input.clientId,
            clientSecret: input.clientSecret,
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
            isActive: false,
            lastSync: null,
          });
          
          // Depois trocar o código por token (a função já salva os tokens)
          await blingService.exchangeCodeForToken(ctx.user.id, input.code);
          
          return { success: true, message: "Autorização concluída com sucesso!" };
        } catch (error: any) {
          console.error("[exchangeCode] Erro:", error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || "Erro ao trocar código por token",
            cause: error,
          });
        }
      }),
    
    // Forçar renovação manual do token
    renewToken: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const { checkAndRenewToken } = await import('./tokenRenewalJob');
        await checkAndRenewToken(ctx.user.id);
        
        // Verificar se foi renovado com sucesso
        const config = await db.getBlingConfig(ctx.user.id);
        const now = new Date();
        const expiresAt = config?.tokenExpiresAt ? new Date(config.tokenExpiresAt) : new Date(0);
        const hoursRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
        
        if (hoursRemaining > 0) {
          return { 
            success: true, 
            message: `Token renovado com sucesso! Válido por mais ${hoursRemaining}h.`,
            expiresAt: expiresAt.toISOString(),
            hoursRemaining 
          };
        } else {
          throw new Error("Token expirado. Por favor, reautorize o acesso.");
        }
      } catch (error: any) {
        console.error("[renewToken] Erro:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || "Erro ao renovar token",
          cause: error,
        });
      }
    }),
    
    syncProducts: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncManager.executeSync(ctx.user.id, "products", "manual");
        return result;
      } catch (error: any) {
        console.error("[syncProducts] Erro:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || "Erro ao sincronizar produtos",
          cause: error,
        });
      }
    }),
    
    syncInventory: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncManager.executeSync(ctx.user.id, "inventory", "manual");
        return result;
      } catch (error: any) {
        console.error("[syncInventory] Erro:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || "Erro ao sincronizar estoque",
          cause: error,
        });
      }
    }),
    
    syncSales: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncManager.executeSync(ctx.user.id, "sales", "manual");
        return result;
      } catch (error: any) {
        console.error("[syncSales] Erro:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || "Erro ao sincronizar vendas",
          cause: error,
        });
      }
    }),
    
    syncSuppliers: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncManager.executeSync(ctx.user.id, "suppliers", "manual");
        return result;
      } catch (error: any) {
        console.error("[syncSuppliers] Erro:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || "Erro ao sincronizar fornecedores",
          cause: error,
        });
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
      return syncManager.getCurrentSync();
    }),
    
    // Histórico de sincronizações
    getSyncHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getRecentSyncHistory(input?.limit || 20);
      }),
    
    // Configuração de sincronização automática
    getSyncConfig: protectedProcedure.query(async ({ ctx }) => {
      let config = await db.getSyncConfig(ctx.user.id);
      
      // Se não existir, criar com valores padrão
      if (!config) {
        await db.upsertSyncConfig({
          userId: ctx.user.id,
          autoSyncEnabled: false,
          syncFrequencyHours: 168, // 1 semana
        });
        config = await db.getSyncConfig(ctx.user.id);
      }
      
      return config;
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
    
    // Endpoint de teste para buscar pedidos de venda
    testFetchOrders: protectedProcedure
      .input(z.object({
        dataInicial: z.string().optional(),
        dataFinal: z.string().optional(),
        limite: z.number().min(1).max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { testFetchOrders } = await import('./blingService');
        return await testFetchOrders(ctx.user.id, input);
      }),
    
    // Endpoint para atualizar nomes das situações dos pedidos
    updateOrderStatusNames: protectedProcedure.mutation(async ({ ctx }) => {
      const { updateOrderStatusNames } = await import('./blingService');
      return await updateOrderStatusNames(ctx.user.id);
    }),
    
    // Endpoint para buscar pedido específico por número
    fetchOrderByNumber: protectedProcedure
      .input(z.object({ orderNumber: z.string() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const { blingRequest } = await import('./blingService');
          
          // Buscar pedido por número
          const response = await blingRequest<{ data: any[] }>(
            ctx.user.id,
            `/pedidos/vendas?numero=${input.orderNumber}`
          );
          
          if (!response.data || response.data.length === 0) {
            return { success: false, error: 'Pedido não encontrado' };
          }
          
          const pedido = response.data[0];
          
          console.log('===== ESTRUTURA COMPLETA DO PEDIDO =====');
          console.log(JSON.stringify(pedido, null, 2));
          console.log('===== FIM DA ESTRUTURA =====');
          
          return {
            success: true,
            pedido: pedido,
          };
        } catch (error: any) {
          console.error('[fetchOrderByNumber] Erro:', error);
          return {
            success: false,
            error: error.message || 'Erro ao buscar pedido',
          };
        }
      }),
    
    // Endpoint de debug para testar salvamento de 1 pedido
    debugSaveOrder: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const { testFetchOrders } = await import('./blingService');
        const result = await testFetchOrders(ctx.user.id, { limite: 1 });
        
        if (!result.success || result.pedidos.length === 0) {
          return { success: false, error: 'Nenhum pedido encontrado' };
        }
        
        const pedido = result.pedidos[0];
        console.log('[debugSaveOrder] ===== ESTRUTURA COMPLETA DO PEDIDO =====');
        console.log(JSON.stringify(pedido, null, 2));
        console.log('[debugSaveOrder] ===== FIM DA ESTRUTURA =====');
        
        console.log('[debugSaveOrder] Verificando campo itens:', pedido.itens);
        console.log('[debugSaveOrder] Tipo de itens:', typeof pedido.itens);
        console.log('[debugSaveOrder] É array?', Array.isArray(pedido.itens));
        console.log('[debugSaveOrder] Quantidade de itens:', pedido.itens?.length || 0);
        
        // Calcular valor total
        let totalAmount = 0;
        if (pedido.itens && Array.isArray(pedido.itens)) {
          totalAmount = pedido.itens.reduce((sum: number, item: any) => {
            console.log('[debugSaveOrder] Item:', item, 'Valor:', item.valor, 'Quantidade:', item.quantidade);
            return sum + (item.valor * item.quantidade);
          }, 0);
        } else {
          console.log('[debugSaveOrder] ⚠️ AVISO: pedido.itens não é um array válido!');
        }
        
        console.log('[debugSaveOrder] Valor total calculado:', totalAmount);
        
        // Tentar salvar
        try {
          const orderData = {
            blingId: String(pedido.id),
            orderNumber: pedido.numero,
            orderDate: new Date(pedido.data),
            customerName: pedido.contato?.nome || null,
            customerDocument: pedido.contato?.numeroDocumento || null,
            status: String(pedido.situacao?.valor || 'Desconhecido'),
            statusId: pedido.situacao?.id || 0,
            totalAmount: Math.round(totalAmount * 100),
            itemsCount: pedido.itens?.length || 0,
          };
          
          console.log('[debugSaveOrder] Tentando salvar com dados:', JSON.stringify(orderData, null, 2));
          
          await db.upsertOrder(orderData);
          
          return { 
            success: true, 
            message: 'Pedido salvo com sucesso!',
            pedido,
            orderData
          };
        } catch (dbError: any) {
          console.error('[debugSaveOrder] Erro ao salvar no banco:', dbError);
          return { 
            success: false, 
            error: dbError.message || String(dbError),
            stack: dbError.stack,
            pedido,
            cause: dbError.cause
          };
        }
      } catch (error: any) {
        console.error('[debugSaveOrder] Erro geral:', error);
        return { 
          success: false, 
          error: error.message || String(error),
          stack: error.stack
        };
      }
    }),
    
    // Listar situações únicas encontradas nos pedidos importados
    getUniqueOrderStatuses: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUniqueOrderStatuses(ctx.user.id);
      }),
    
    // Listar situações válidas configuradas
    getValidOrderStatuses: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getValidOrderStatuses(ctx.user.id);
      }),
    
    // Salvar situações válidas selecionadas
    saveValidOrderStatuses: protectedProcedure
      .input(z.array(z.object({
        statusId: z.number(),
        statusName: z.string(),
        isActive: z.boolean(),
      })))
      .mutation(async ({ ctx, input }) => {
        // Remover todas as situações existentes do usuário
        const existing = await db.getValidOrderStatuses(ctx.user.id);
        for (const status of existing) {
          await db.deleteValidOrderStatus(status.id);
        }
        
        // Inserir novas situações
        for (const status of input) {
          await db.upsertValidOrderStatus({
            userId: ctx.user.id,
            statusId: status.statusId,
            statusName: status.statusName,
            isActive: status.isActive,
          });
        }
        
        return { success: true };
      }),
    
    // Listar situações de pedidos disponíveis no Bling
    listOrderSituations: protectedProcedure.query(async ({ ctx }) => {
      try {
        const situations = await blingService.listOrderSituations(ctx.user.id);
        return situations;
      } catch (error: any) {
        console.error("[listOrderSituations] Erro:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || "Erro ao listar situações de pedidos",
          cause: error,
        });
      }
    }),
    
    // Registrar webhook no Bling
    registerWebhook: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const { blingRequest } = await import('./blingService');
        
        // Obter URL pública do sistema
        // Usar a URL do servidor Express (não VITE_FRONTEND_FORGE_API_URL que aponta para forge.manus.ai)
        const baseUrl = process.env.PUBLIC_URL || 'https://3000-ioo03l8ysgl09eq24gr3e-47328ca2.manusvm.computer';
        const webhookUrl = `${baseUrl}/api/webhooks/bling`;
        
        // Registrar webhook para eventos de pedidos
        const response = await blingRequest(
          ctx.user.id,
          '/webhooks',
          {
            method: 'POST',
            body: JSON.stringify({
              url: webhookUrl,
              events: [
                'order.created',
                'order.updated',
              ],
              description: 'Webhook para sincroniza\u00e7\u00e3o autom\u00e1tica de pedidos',
            }),
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        console.log('[registerWebhook] Webhook registrado:', response);
        
        return {
          success: true,
          message: 'Webhook registrado com sucesso!',
          webhookUrl,
        };
      } catch (error: any) {
        console.error('[registerWebhook] Erro:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro ao registrar webhook',
          cause: error,
        });
      }
    }),
    
    // Listar webhooks registrados
    listWebhooks: protectedProcedure.query(async ({ ctx }) => {
      try {
        const { blingRequest } = await import('./blingService');
        const response = await blingRequest<{ data: any[] }>(ctx.user.id, '/webhooks');
        return response.data || [];
      } catch (error: any) {
        console.error('[listWebhooks] Erro:', error);
        // Se não está autorizado ou webhook não encontrado, retornar array vazio
        if (error.message && (error.message.includes('autorizar') || error.message.includes('encontrado'))) {
          return [];
        }
        // Retornar array vazio para qualquer erro ao invés de quebrar a página
        return [];
      }
    }),
  }),



  // Produtos
  products: router({
    list: protectedProcedure
      .input(z.object({
        abcClass: z.enum(["A", "B", "C", "D"]).optional(),
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
        abcClass: z.enum(["A", "B", "C", "D"]).optional(),
        abcClassManual: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const product = await db.getProductById(id);
        if (!product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: "Produto não encontrado",
          });
        }
        
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

  // Monitoramento de API
  apiMonitoring: router({
    getUsageToday: protectedProcedure.query(async ({ ctx }) => {
      return await db.getApiUsageToday(ctx.user.id);
    }),
    
    getUsageStats: protectedProcedure
      .input(z.object({ days: z.number().default(7) }))
      .query(async ({ ctx, input }) => {
        return await db.getApiUsageStats(ctx.user.id, input.days);
      }),
    
    getRecentErrors: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ ctx, input }) => {
        return await db.getRecentRateLimitErrors(ctx.user.id, input.limit);
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

  // Análise ABC+D
  abc: router({
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAbcConfig(ctx.user.id);
    }),
    
    updateConfig: protectedProcedure
      .input(z.object({
        analysisMonths: z.number().min(1).max(24).optional(),
        autoRecalculate: z.boolean().optional(),
        revenueWeight: z.number().min(0).max(100).optional(),
        quantityWeight: z.number().min(0).max(100).optional(),
        ordersWeight: z.number().min(0).max(100).optional(),
      }).refine(
        (data) => {
          // Se algum peso foi fornecido, validar que a soma = 100
          if (data.revenueWeight !== undefined || data.quantityWeight !== undefined || data.ordersWeight !== undefined) {
            const revenue = data.revenueWeight ?? 0;
            const quantity = data.quantityWeight ?? 0;
            const orders = data.ordersWeight ?? 0;
            return revenue + quantity + orders === 100;
          }
          return true;
        },
        {
          message: "A soma dos pesos deve ser 100%",
        }
      ))
      .mutation(async ({ ctx, input }) => {
        await db.updateAbcConfig(ctx.user.id, input);
        return { success: true };
      }),
    
    calculate: protectedProcedure.mutation(async ({ ctx }) => {
      // Executar em background (fire-and-forget) sem bloquear resposta
      db.calculateAbcClassification(ctx.user.id)
        .then(result => {
          console.log('[ABC] Cálculo concluído:', result);
        })
        .catch(error => {
          console.error('[ABC] Erro no cálculo:', error);
        });
      
      return { 
        success: true, 
        message: 'Cálculo ABC iniciado. Aguarde alguns minutos para conclusão.' 
      };
    }),
    
    getDistribution: protectedProcedure.query(async () => {
      const products = await db.getAllProducts();
      return {
        A: products.filter(p => p.abcClass === "A").length,
        B: products.filter(p => p.abcClass === "B").length,
        C: products.filter(p => p.abcClass === "C").length,
        D: products.filter(p => p.abcClass === "D").length,
        total: products.length,
      };
    }),
    
    getStockMetrics: protectedProcedure.query(async () => {
      return await db.getAbcStockMetrics();
    }),
    
    getCounts: protectedProcedure.query(async () => {
      return await db.getAbcCounts();
    }),
    
    getEvolutionStats: protectedProcedure
      .input(z.object({
        months: z.number().min(1).max(12).optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getEvolutionStats(input?.months || 6);
      }),
    
    getClassChanges: protectedProcedure
      .input(z.object({
        months: z.number().min(1).max(12).optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getClassChanges(input?.months || 6);
      }),
    
    analyzeWithAI: protectedProcedure.mutation(async ({ ctx }) => {
      return await db.generateAbcAnalysisWithAI(ctx.user.id);
    }),
    
    getAutoCalculationConfig: protectedProcedure.query(async ({ ctx }) => {
      let config = await db.getAbcAutoCalculationConfig(ctx.user.id);
      
      // Se não existe, criar com valores padrão
      if (!config) {
        await db.upsertAbcAutoCalculationConfig({
          userId: ctx.user.id,
          enabled: true,
          frequency: "weekly",
        });
        config = await db.getAbcAutoCalculationConfig(ctx.user.id);
      }
      
      return config;
    }),
    
    updateAutoCalculationConfig: protectedProcedure
      .input(z.object({
        enabled: z.boolean().optional(),
        frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateAbcAutoCalculationConfig(ctx.user.id, input);
        return { success: true };
      }),
    
    getProductsByClass: protectedProcedure
      .input(z.object({
        abcClass: z.enum(["A", "B", "C", "D"]),
        limit: z.number().optional(),
        offset: z.number().optional(),
        orderBy: z.string().optional(),
        orderDirection: z.enum(["asc", "desc"]).optional(),
        filters: z.object({
          lowStock: z.boolean().optional(),
          noSupplier: z.boolean().optional(),
          highTurnover: z.boolean().optional(),
        }).optional(),
      }))
      .query(async ({ input }) => {
        return await db.getProductsByAbcClass(
          input.abcClass,
          input.limit || 100,
          input.offset || 0,
          input.orderBy || 'relevanceScore',
          input.orderDirection || 'desc',
          input.filters
        );
      }),
    
    getMonthlySales: protectedProcedure
      .input(z.object({
        productId: z.number(),
        months: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getMonthlySalesByProduct(
          input.productId,
          input.months || 12
        );
      }),
    
    exportToExcel: protectedProcedure
      .input(z.object({
        abcClass: z.enum(["A", "B", "C", "D"]),
        orderBy: z.string().optional(),
        orderDirection: z.enum(["asc", "desc"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const XLSX = await import('xlsx');
        
        // Buscar TODOS os produtos da classe (sem limit)
        const data = await db.getProductsByAbcClass(
          input.abcClass,
          10000, // Limite alto para pegar todos
          0,
          input.orderBy || 'physicalStock',
          input.orderDirection || 'desc'
        );
        
        // Preparar dados para Excel
        const excelData = data.products.map(p => ({
          'Código': p.code,
          'Descrição': p.name,
          'Estoque Físico': p.physicalStock,
          'Qtd. Vendida': p.totalQuantitySold || 0,
          'Nº Pedidos': p.totalOrders || 0,
          'Média Mensal': Number(p.averageMonthlySales || 0).toFixed(1),
          'Giro de Estoque': Number(p.stockTurnover || 0).toFixed(2) + 'x',
          'Fornecedor': p.supplierName || '-',
          'Faturamento': new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }).format(p.abcRevenue || 0),
        }));
        
        // Criar workbook
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Classe ${input.abcClass}`);
        
        // Gerar buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Retornar base64 para download no frontend
        return {
          data: buffer.toString('base64'),
          filename: `Classe_${input.abcClass}_${new Date().toISOString().split('T')[0]}.xlsx`,
          totalProducts: data.products.length,
        };
      }),
    
    getProducts: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
        search: z.string().optional(),
        classFilter: z.enum(["A", "B", "C", "D", "all"]).optional(),
        sortBy: z.enum(["revenue", "name", "code"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const products = await db.getAllProducts();
        
        let filtered = products;
        
        // Filtrar por classe
        if (input?.classFilter && input.classFilter !== "all") {
          filtered = filtered.filter(p => p.abcClass === input.classFilter);
        }
        
        // Busca por texto
        if (input?.search) {
          const searchLower = input.search.toLowerCase();
          filtered = filtered.filter(p => 
            p.name?.toLowerCase().includes(searchLower) ||
            p.code?.toLowerCase().includes(searchLower)
          );
        }
        
        // Ordenação
        if (input?.sortBy === "revenue") {
          filtered.sort((a, b) => (b.abcRevenue || 0) - (a.abcRevenue || 0));
        } else if (input?.sortBy === "name") {
          filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        } else if (input?.sortBy === "code") {
          filtered.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
        } else {
          // Padrão: ordenar por faturamento
          filtered.sort((a, b) => (b.abcRevenue || 0) - (a.abcRevenue || 0));
        }
        
        const total = filtered.length;
        const offset = input?.offset || 0;
        const limit = input?.limit || 1000;
        
        return {
          products: filtered.slice(offset, offset + limit),
          total,
        };
      }),
  }),

  // Pedidos de Venda
  orders: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
        search: z.string().optional(),
        status: z.string().optional(),
        filterByValidStatuses: z.boolean().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.listOrders({
          ...input,
          userId: ctx.user.id,
          filterByValidStatuses: input?.filterByValidStatuses ?? true, // Filtrar por padrão
        });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Pedido não encontrado',
          });
        }
        return order;
      }),

    stats: protectedProcedure.query(async () => {
      return await db.getOrdersStats();
    }),
  }),
  replenishment: router({
    getProducts: protectedProcedure
      .input(z.object({
        supplierId: z.string().optional(),
        abcClass: z.enum(["A", "B", "C", "D"]).optional(),
        priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getProductsForReplenishment, getSalesForProduct } = await import("./db");
        const { calculateReplenishmentMetrics } = await import("./replenishmentFormulas");
        const products = await getProductsForReplenishment(input);
        const productsWithMetrics = await Promise.all(
          products.map(async (product) => {
            const sales = await getSalesForProduct(product.productId, 12);
            const metrics = calculateReplenishmentMetrics(
              sales, product.physicalStock || 0, product.abcClass as "A" | "B" | "C" | "D",
              product.leadTimeDays || 7, product.maxStock, product.safetyStock || 0
            );
            return { ...product, metrics };
          })
        );
        let filtered = productsWithMetrics;
        if (input?.priority) filtered = filtered.filter(p => p.metrics.priority === input.priority);
        const grouped = filtered.reduce((acc, product) => {
          const supplierId = product.supplierId || "sem-fornecedor";
          const supplierName = product.supplierName || "Sem Fornecedor";
          if (!acc[supplierId]) acc[supplierId] = { supplierId, supplierName, products: [] };
          acc[supplierId].products.push(product);
          return acc;
        }, {} as Record<string, any>);
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
        const abcOrder = { A: 0, B: 1, C: 2, D: 3 };
        Object.values(grouped).forEach((supplier: any) => {
          supplier.products.sort((a: any, b: any) => {
            const diff = priorityOrder[a.metrics.priority as keyof typeof priorityOrder] - priorityOrder[b.metrics.priority as keyof typeof priorityOrder];
            return diff !== 0 ? diff : abcOrder[a.abcClass as keyof typeof abcOrder] - abcOrder[b.abcClass as keyof typeof abcOrder];
          });
        });
        return Object.values(grouped).sort((a: any, b: any) => {
          const maxA = Math.min(...a.products.map((p: any) => priorityOrder[p.metrics.priority as keyof typeof priorityOrder]));
          const maxB = Math.min(...b.products.map((p: any) => priorityOrder[p.metrics.priority as keyof typeof priorityOrder]));
          return maxA - maxB;
        });
      }),
    getSuppliers: protectedProcedure.query(async () => {
      const { getUniqueSuppliers } = await import("./db");
      return await getUniqueSuppliers();
    }),
    updateLeadTime: protectedProcedure
      .input(z.object({ productId: z.number(), supplierId: z.string(), leadTimeDays: z.number().min(0) }))
      .mutation(async ({ input }) => {
        const { updateSupplierLeadTime } = await import("./db");
        await updateSupplierLeadTime(input.productId, input.supplierId, input.leadTimeDays);
        return { success: true };
      }),
    updateMaxStock: protectedProcedure
      .input(z.object({ productId: z.number(), maxStock: z.number().min(0) }))
      .mutation(async ({ input }) => {
        const { updateProductMaxStock } = await import("./db");
        await updateProductMaxStock(input.productId, input.maxStock);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
