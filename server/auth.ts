/**
 * Sistema de Autenticação Híbrido Simplificado
 * Suporta: Google OAuth + Email/Senha
 * Sessão persistente: 30 dias
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from './_core/env';

// TEMPORÁRIO: Fallback para teste (REMOVER EM PRODUÇÃO)
const FALLBACK_JWT_SECRET = 'a78ab949198597689777d06c84656aff2d2ebb3b708b74b858fbe9244223653fb73361b6e281341f9afba36f27b01fa051031d12c490eff75c5ebd6ac7254059';

// Verificação robusta: detecta undefined, null E string vazia
const envJwtSecret = process.env.JWT_SECRET?.trim();
if (!envJwtSecret || envJwtSecret.length === 0) {
  console.warn('\n' + '='.repeat(80));
  console.warn('⚠️  AVISO: JWT_SECRET não está definido ou está vazio!');
  console.warn('='.repeat(80));
  console.warn('Usando chave temporária para teste.');
  console.warn('ATENÇÃO: Configure JWT_SECRET no Railway para produção!');
  console.warn('='.repeat(80) + '\n');
}

const JWT_SECRET = (envJwtSecret && envJwtSecret.length > 0) ? envJwtSecret : FALLBACK_JWT_SECRET;
const JWT_EXPIRATION = '30d'; // Sessão persistente de 30 dias

console.log('[AUTH] ✅ JWT_SECRET configurado (length:', JWT_SECRET.length, ')');

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

/**
 * Verifica e decodifica JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
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
