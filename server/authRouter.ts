/**
 * Router de Autenticação tRPC - Sistema Simplificado
 * Apenas Email/Senha para uso interno
 * Sessão persistente: 30 dias
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from './_core/trpc';
import * as userDb from './userDb';
import * as emailService from './emailService';
import { generateToken } from './auth';

export const authRouter = router({
  /**
   * Login com email/senha
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email('Email inválido'),
        password: z.string().min(1, 'Senha é obrigatória'),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Verificar credenciais
        const user = await userDb.verifyPassword(input.email, input.password);
        
        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Email ou senha incorretos',
          });
        }

        // Gerar token JWT (30 dias)
        const token = generateToken({
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        // Parse permissions
        const permissions = JSON.parse(user.permissions || '[]');

        return {
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permissions,
          },
        };
      } catch (error) {
        console.error('[AuthRouter] Erro no login:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao fazer login',
        });
      }
    }),

  /**
   * Obter dados do usuário logado (via token JWT)
   */
  me: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const { verifyToken } = await import('./auth');
        
        // Verificar token
        const payload = verifyToken(input.token);
        
        if (!payload) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Token inválido ou expirado',
          });
        }

        // Buscar usuário atualizado
        const user = await userDb.getUserById(payload.userId);
        
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Usuário não encontrado',
          });
        }

        // Parse permissions
        const permissions = JSON.parse(user.permissions || '[]');

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions,
        };
      } catch (error) {
        console.error('[AuthRouter] Erro ao buscar usuário:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao buscar dados do usuário',
        });
      }
    }),

  /**
   * Logout (apenas limpa token no frontend)
   */
  logout: publicProcedure.mutation(() => {
    return {
      success: true,
      message: 'Logout realizado com sucesso',
    };
  }),

  /**
   * Solicitar recuperação de senha (envia senha atual por email)
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email('Email inválido'),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Buscar usuário por email
        const user = await userDb.getUserByEmail(input.email);
        
        // Por segurança, sempre retorna sucesso mesmo se o email não existir
        if (!user) {
          return {
            success: true,
            message: 'Se o email existir, você receberá as instruções de recuperação',
          };
        }

        // Gerar nova senha temporária
        const tempPassword = Math.random().toString(36).slice(-8);
        await userDb.resetUserPassword(user.id, tempPassword);

        // Enviar email com nova senha
        const emailSent = await emailService.sendPasswordRecoveryEmail(
          user.email,
          user.name,
          tempPassword
        );

        if (!emailSent) {
          console.error('[AuthRouter] Falha ao enviar email de recuperação');
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erro ao enviar email de recuperação',
          });
        }

        return {
          success: true,
          message: 'Email de recuperação enviado com sucesso',
        };
      } catch (error) {
        console.error('[AuthRouter] Erro na recuperação de senha:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao solicitar recuperação de senha',
        });
      }
    }),
});
