import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as auditService from "./auditService";

// Middleware para verificar se é master ou admin
const masterOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "master" && ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Apenas master e administradores podem acessar logs de auditoria.",
    });
  }
  return next({ ctx });
});

export const auditRouter = router({
  /**
   * Lista logs de auditoria com filtros
   */
  list: masterOrAdminProcedure
    .input(
      z.object({
        userId: z.number().optional(),
        action: z.enum([
          "login",
          "logout",
          "user_created",
          "user_updated",
          "user_deleted",
          "password_changed",
          "password_reset",
          "permission_granted",
          "permission_revoked",
        ]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await auditService.listAuditLogs({
          userId: input.userId,
          action: input.action,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          limit: input.limit,
          offset: input.offset,
        });

        return result;
      } catch (error) {
        console.error("[AuditRouter] Erro ao listar logs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao listar logs de auditoria",
        });
      }
    }),

  /**
   * Busca logs de um usuário específico
   */
  getUserLogs: masterOrAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      try {
        return await auditService.getUserAuditLogs(input.userId, input.limit);
      } catch (error) {
        console.error("[AuditRouter] Erro ao buscar logs do usuário:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao buscar logs do usuário",
        });
      }
    }),

  /**
   * Estatísticas de auditoria
   */
  stats: masterOrAdminProcedure.query(async () => {
    try {
      // Buscar últimas 24h de cada tipo de ação
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const actions: auditService.AuditAction[] = [
        "login",
        "logout",
        "user_created",
        "user_updated",
        "user_deleted",
        "password_changed",
        "password_reset",
        "permission_granted",
        "permission_revoked",
      ];

      const stats: Record<string, number> = {};

      for (const action of actions) {
        const result = await auditService.listAuditLogs({
          action,
          startDate: yesterday,
          limit: 1000,
        });
        stats[action] = result.total;
      }

      return {
        last24Hours: stats,
        period: {
          start: yesterday.toISOString(),
          end: now.toISOString(),
        },
      };
    } catch (error) {
      console.error("[AuditRouter] Erro ao buscar estatísticas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao buscar estatísticas de auditoria",
      });
    }
  }),
});
