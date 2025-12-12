import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as userDb from "./userDb";
import * as emailService from "./emailService";

// Middleware para verificar se usuário pode gerenciar outros usuários
const canManageUsersProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!userDb.canManageUsers(ctx.user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não tem permissão para gerenciar usuários",
    });
  }
  return next({ ctx });
});

// Middleware apenas para master
const masterOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "master") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas o usuário master pode realizar esta ação",
    });
  }
  return next({ ctx });
});

export const userRouter = router({
  /**
   * Lista todos os usuários
   */
  list: canManageUsersProcedure
    .input(
      z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        return await userDb.listUsers(input);
      } catch (error) {
        console.error("[UserRouter] Erro ao listar usuários:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao listar usuários",
        });
      }
    }),

  /**
   * Busca usuário por ID
   */
  getById: canManageUsersProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const user = await userDb.getUserById(input.id);
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuário não encontrado",
          });
        }
        return user;
      } catch (error) {
        console.error("[UserRouter] Erro ao buscar usuário:", error);
        throw error;
      }
    }),

  /**
   * Cria novo usuário
   */
  create: canManageUsersProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
        role: z.enum(["user", "admin"]).optional(),
        permissions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verificar se email já existe
        const existing = await userDb.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Email já cadastrado",
          });
        }

        // Apenas master pode criar admins ou conceder permissões
        if (ctx.user.role !== "master") {
          if (input.role === "admin" || (input.permissions && input.permissions.length > 0)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Apenas o master pode criar admins ou conceder permissões",
            });
          }
        }

        // Criar usuário
        const user = await userDb.createUser({
          name: input.name,
          email: input.email,
          password: input.password,
          role: input.role || "user",
          permissions: input.permissions || [],
        });

        // Enviar email de boas-vindas
        const emailSent = await emailService.sendWelcomeEmail(
          user.email,
          user.name,
          input.password
        );

        if (!emailSent) {
          console.warn("[UserRouter] Falha ao enviar email de boas-vindas");
        }

        return {
          success: true,
          user,
          emailSent,
        };
      } catch (error) {
        console.error("[UserRouter] Erro ao criar usuário:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao criar usuário",
        });
      }
    }),

  /**
   * Atualiza usuário
   */
  update: canManageUsersProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).optional(),
        permissions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Não pode editar o próprio usuário
        if (input.id === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Você não pode editar seu próprio usuário",
          });
        }

        // Buscar usuário alvo
        const targetUser = await userDb.getUserById(input.id);
        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuário não encontrado",
          });
        }

        // Não pode editar master
        if (targetUser.role === "master") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Não é possível editar o usuário master",
          });
        }

        // Apenas master pode alterar role ou permissions
        if (ctx.user.role !== "master") {
          if (input.role !== undefined || input.permissions !== undefined) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Apenas o master pode alterar role ou permissões",
            });
          }
        }

        // Verificar se novo email já existe
        if (input.email && input.email !== targetUser.email) {
          const existing = await userDb.getUserByEmail(input.email);
          if (existing) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Email já cadastrado",
            });
          }
        }

        const user = await userDb.updateUser(input.id, {
          name: input.name,
          email: input.email,
          role: input.role,
          permissions: input.permissions,
        });

        return { success: true, user };
      } catch (error) {
        console.error("[UserRouter] Erro ao atualizar usuário:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao atualizar usuário",
        });
      }
    }),

  /**
   * Reseta senha de usuário
   */
  resetPassword: canManageUsersProcedure
    .input(
      z.object({
        id: z.number(),
        newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Não pode resetar própria senha por aqui
        if (input.id === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Use a opção 'Alterar Senha' para mudar sua própria senha",
          });
        }

        // Buscar usuário alvo
        const targetUser = await userDb.getUserById(input.id);
        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuário não encontrado",
          });
        }

        // Não pode resetar senha do master
        if (targetUser.role === "master") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Não é possível resetar a senha do usuário master",
          });
        }

        // Resetar senha
        const user = await userDb.resetUserPassword(input.id, input.newPassword);

        // Enviar email com nova senha
        const emailSent = await emailService.sendPasswordResetEmail(
          user.email,
          user.name,
          input.newPassword
        );

        if (!emailSent) {
          console.warn("[UserRouter] Falha ao enviar email de reset de senha");
        }

        return { success: true, user, emailSent };
      } catch (error) {
        console.error("[UserRouter] Erro ao resetar senha:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao resetar senha",
        });
      }
    }),

  /**
   * Deleta usuário
   */
  delete: canManageUsersProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Não pode deletar a si mesmo
        if (input.id === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Você não pode deletar seu próprio usuário",
          });
        }

        // Buscar usuário alvo
        const targetUser = await userDb.getUserById(input.id);
        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuário não encontrado",
          });
        }

        // Não pode deletar master
        if (targetUser.role === "master") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Não é possível deletar o usuário master",
          });
        }

        await userDb.deleteUser(input.id);

        return { success: true };
      } catch (error) {
        console.error("[UserRouter] Erro ao deletar usuário:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao deletar usuário",
        });
      }
    }),

  /**
   * Concede permissão a usuário (apenas master)
   */
  grantPermission: masterOnlyProcedure
    .input(
      z.object({
        userId: z.number(),
        permission: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const user = await userDb.grantPermission(input.userId, input.permission);
        return { success: true, user };
      } catch (error) {
        console.error("[UserRouter] Erro ao conceder permissão:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao conceder permissão",
        });
      }
    }),

  /**
   * Revoga permissão de usuário (apenas master)
   */
  revokePermission: masterOnlyProcedure
    .input(
      z.object({
        userId: z.number(),
        permission: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const user = await userDb.revokePermission(input.userId, input.permission);
        return { success: true, user };
      } catch (error) {
        console.error("[UserRouter] Erro ao revogar permissão:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao revogar permissão",
        });
      }
    }),

  /**
   * Recupera senha por email
   */
  recoverPassword: z
    .object({
      email: z.string().email("Email inválido"),
    })
    .mutation(async ({ input }) => {
      try {
        // Buscar usuário
        const user = await userDb.getUserByEmail(input.email);
        if (!user) {
          // Por segurança, não revelar se email existe ou não
          return {
            success: true,
            message: "Se o email existir, você receberá as instruções de recuperação",
          };
        }

        // Gerar nova senha temporária
        const tempPassword = Math.random().toString(36).slice(-8);
        await userDb.resetUserPassword(user.id, tempPassword);

        // Enviar email
        const emailSent = await emailService.sendPasswordRecoveryEmail(
          user.email,
          user.name,
          tempPassword
        );

        if (!emailSent) {
          console.error("[UserRouter] Falha ao enviar email de recuperação");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao enviar email de recuperação",
          });
        }

        return {
          success: true,
          message: "Email de recuperação enviado com sucesso",
        };
      } catch (error) {
        console.error("[UserRouter] Erro ao recuperar senha:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao recuperar senha",
        });
      }
    }),
});
