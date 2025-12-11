/**
 * Sistema de Autenticação Híbrido Simplificado
 * Suporta: Google OAuth + Email/Senha
 * Sessão persistente: 30 dias
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from './_core/env';

// Validação crítica: JWT_SECRET DEVE existir
if (!process.env.JWT_SECRET) {
  console.error('\n' + '='.repeat(80));
  console.error('❌ ERRO CRÍTICO: JWT_SECRET não está definido!');
  console.error('='.repeat(80));
  console.error('Variáveis de ambiente disponíveis:');
  console.error('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ definido' : '❌ não definido');
  console.error('- NODE_ENV:', process.env.NODE_ENV || 'não definido');
  console.error('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ definido' : '❌ NÃO DEFINIDO');
  console.error('='.repeat(80));
  console.error('Por favor, configure JWT_SECRET nas variáveis de ambiente do Railway');
  console.error('='.repeat(80) + '\n');
  throw new Error('JWT_SECRET não está configurado. Impossível iniciar servidor.');
}

const JWT_SECRET = process.env.JWT_SECRET;
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
