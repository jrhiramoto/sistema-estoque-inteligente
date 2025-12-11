/**
 * Router de Autenticação tRPC
 * Suporta: Email/Senha e Google OAuth
 * Sessão persistente: 30 dias
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from './_core/trpc';
import * as db from './db';
import {
  hashPassword,
  comparePassword,
  generateToken,
  validatePassword,
  validateEmail,
} from './auth';
import { configureGoogleOAuth, isGoogleOAuthEnabled } from './googleOAuth';

// Configurar Google OAuth ao inicializar
configureGoogleOAuth();

export const authRouter = router({
  /**
   * Verifica se Google OAuth está habilitado
   */
  googleStatus: publicProcedure.query(() => {
    return { enabled: isGoogleOAuthEnabled() };
  }),

  /**
   * Registro com email/senha (simplificado)
   */
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
        email: z.string().email('Email inválido'),
        password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
      })
    )
    .mutation(async ({ input }) => {
      // Validar email
      if (!validateEmail(input.email)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Email inválido',
        });
      }

      // Validar senha
      const passwordValidation = validatePassword(input.password);
      if (!passwordValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.message || 'Senha inválida',
        });
      }

      // Verificar se email já existe
      const existingUser = await db.getUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email já cadastrado',
        });
      }

      // Criar hash da senha
      const passwordHash = await hashPassword(input.password);

      // Criar usuário
      const user = await db.createUserWithPassword({
        name: input.name,
        email: input.email,
        passwordHash,
      });

      // Gerar token JWT (30 dias)
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }),

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
      // Buscar usuário por email
      const user = await db.getUserByEmail(input.email);
      
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Email ou senha incorretos',
        });
      }

      // Verificar senha
      const isPasswordValid = await comparePassword(input.password, user.passwordHash);
      
      if (!isPasswordValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Email ou senha incorretos',
        });
      }

      // Atualizar último login
      await db.updateUserLastSignedIn(user.id);

      // Gerar token JWT (30 dias)
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          loginMethod: user.loginMethod,
        },
      };
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
      const user = await db.getUserById(payload.userId);
      
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        });
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        loginMethod: user.loginMethod,
      };
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
   * Solicitar recuperação de senha
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email('Email inválido'),
      })
    )
    .mutation(async ({ input }) => {
      // Buscar usuário por email
      const user = await db.getUserByEmail(input.email);
      
      // Por segurança, sempre retorna sucesso mesmo se o email não existir
      // Isso evita que atacantes descubram quais emails estão cadastrados
      if (!user) {
        return {
          success: true,
          message: 'Se o email existir, você receberá um link de recuperação',
        };
      }

      // Verificar se o usuário tem senha (não é apenas Google OAuth)
      if (!user.passwordHash) {
        return {
          success: true,
          message: 'Se o email existir, você receberá um link de recuperação',
        };
      }

      // Criar token de recuperação
      const { createPasswordResetToken, sendPasswordResetEmail } = await import('./passwordResetService');
      const token = await createPasswordResetToken(user.id);
      
      // Enviar email
      await sendPasswordResetEmail(user.email, token);

      return {
        success: true,
        message: 'Se o email existir, você receberá um link de recuperação',
      };
    }),

  /**
   * Validar token de recuperação de senha
   */
  validateResetToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { validatePasswordResetToken } = await import('./passwordResetService');
      const resetToken = await validatePasswordResetToken(input.token);

      if (!resetToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Token inválido ou expirado',
        });
      }

      return {
        valid: true,
        userId: resetToken.userId,
      };
    }),

  /**
   * Redefinir senha usando token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
      })
    )
    .mutation(async ({ input }) => {
      // Validar token
      const { validatePasswordResetToken, markTokenAsUsed } = await import('./passwordResetService');
      const resetToken = await validatePasswordResetToken(input.token);

      if (!resetToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Token inválido ou expirado',
        });
      }

      // Validar senha
      const passwordValidation = validatePassword(input.newPassword);
      if (!passwordValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.message || 'Senha inválida',
        });
      }

      // Criar hash da nova senha
      const passwordHash = await hashPassword(input.newPassword);

      // Atualizar senha do usuário
      await db.updateUserPassword(resetToken.userId, passwordHash);

      // Marcar token como usado
      await markTokenAsUsed(input.token);

      return {
        success: true,
        message: 'Senha redefinida com sucesso',
      };
    }),
});
