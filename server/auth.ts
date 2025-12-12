/**
 * Sistema de Autenticação Híbrido Simplificado
 * Suporta: Google OAuth + Email/Senha
 * Sessão persistente: 30 dias
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Chave padrão hardcoded - SEMPRE disponível
const DEFAULT_JWT_SECRET = 'a78ab949198597689777d06c84656aff2d2ebb3b708b74b858fbe9244223653fb73361b6e281341f9afba36f27b01fa051031d12c490eff75c5ebd6ac7254059';
const JWT_EXPIRATION = '30d'; // Sessão persistente de 30 dias

/**
 * Obtém JWT_SECRET de forma lazy (avaliado no momento de uso)
 * Garante que SEMPRE retorna um valor válido
 */
function getJwtSecret(): string {
  try {
    const envSecret = process.env.JWT_SECRET?.trim();
    if (envSecret && envSecret.length > 0) {
      return envSecret;
    }
  } catch (error) {
    console.warn('[AUTH] Erro ao ler JWT_SECRET do ambiente:', error);
  }
  return DEFAULT_JWT_SECRET;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

/**
 * Gera hash da senha
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compara senha com hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Gera JWT token com expiração de 30 dias
 */
export function generateToken(payload: JWTPayload): string {
  const secret = getJwtSecret();
  console.log('[AUTH] generateToken - secret length:', secret.length);
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRATION });
}

/**
 * Verifica e decodifica JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Valida força da senha (simplificado para uso interno)
 * Mínimo: 6 caracteres
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: 'Senha deve ter no mínimo 6 caracteres' };
  }
  return { valid: true };
}

/**
 * Valida formato de email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
