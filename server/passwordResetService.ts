/**
 * Serviço de Recuperação de Senha
 * Gera tokens seguros e envia emails de recuperação
 */

import crypto from 'crypto';
import * as db from './db';

/**
 * Gera um token aleatório seguro
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Cria um token de recuperação de senha
 * @param userId ID do usuário
 * @returns Token gerado
 */
export async function createPasswordResetToken(userId: number): Promise<string> {
  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await db.createPasswordResetToken({
    userId,
    token,
    expiresAt,
    used: false,
  });

  return token;
}

/**
 * Valida um token de recuperação de senha
 * @param token Token a ser validado
 * @returns Dados do token se válido, null caso contrário
 */
export async function validatePasswordResetToken(token: string) {
  const resetToken = await db.getPasswordResetToken(token);

  if (!resetToken) {
    return null;
  }

  // Verificar se o token já foi usado
  if (resetToken.used) {
    return null;
  }

  // Verificar se o token expirou
  if (new Date() > resetToken.expiresAt) {
    return null;
  }

  return resetToken;
}

/**
 * Marca um token como usado
 * @param token Token a ser marcado
 */
export async function markTokenAsUsed(token: string): Promise<void> {
  await db.markPasswordResetTokenAsUsed(token);
}

/**
 * Envia email de recuperação de senha
 * @param email Email do destinatário
 * @param token Token de recuperação
 * @returns true se enviado com sucesso
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  // TODO: Implementar envio de email real
  // Por enquanto, apenas loga o token no console
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  
  console.log(`
    ═══════════════════════════════════════════════════════════
    📧 EMAIL DE RECUPERAÇÃO DE SENHA
    ═══════════════════════════════════════════════════════════
    Para: ${email}
    Link: ${resetUrl}
    Token: ${token}
    Expira em: 1 hora
    ═══════════════════════════════════════════════════════════
  `);

  // Retorna true para simular envio bem-sucedido
  return true;
}
