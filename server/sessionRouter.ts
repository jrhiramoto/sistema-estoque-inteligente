import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as sessionService from "./sessionService";

export const sessionRouter = router({
  /**
   * Lista sessões ativas do usuário logado
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const sessions = await sessionService.getUserSessions(ctx.user.id);

      return {
        sessions: sessions.map((session) => ({
          id: session.id,
          ipAddress: session.ipAddress,
          deviceInfo: session.deviceInfo,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          // Não retornar o token por segurança
        })),
      };
    } catch (error) {
      console.error("[SessionRouter] Erro ao listar sessões:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao listar sessões ativas",
      });
    }
  }),

  /**
   * Desconecta uma sessão específica
   */
  revoke: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const success = await sessionService.revokeSession(input.sessionId, ctx.user.id);

        if (!success) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sessão não encontrada",
          });
        }

        return {
          success: true,
          message: "Sessão desconectada com sucesso",
        };
      } catch (error) {
        console.error("[SessionRouter] Erro ao desconectar sessão:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao desconectar sessão",
        });
      }
    }),

  /**
   * Desconecta todas as outras sessões (exceto a atual)
   */
  revokeOthers: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Obter token da sessão atual do header
      const authHeader = ctx.req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Token não encontrado",
        });
      }

      const currentToken = authHeader.substring(7);

      await sessionService.revokeOtherSessions(ctx.user.id, currentToken);

      return {
        success: true,
        message: "Todas as outras sessões foram desconectadas",
      };
    } catch (error) {
      console.error("[SessionRouter] Erro ao desconectar outras sessões:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao desconectar outras sessões",
      });
    }
  }),
});
