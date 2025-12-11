/**
 * Google OAuth 2.0 Implementation
 * Com vinculação automática de contas por email
 */

import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import passport from 'passport';
import * as db from './db';
import { generateToken } from './auth';

// Configuração do Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// Detectar URL de callback dinamicamente
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 
  (process.env.NODE_ENV === 'production' 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'web-production-0e33.up.railway.app'}/api/auth/google/callback`
    : 'http://localhost:3000/api/auth/google/callback');

/**
 * Configura estratégia do Google OAuth
 */
export function configureGoogleOAuth() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('[Google OAuth] Credenciais não configuradas. Google login desabilitado.');
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleUser = {
            openId: profile.id,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName || profile.emails?.[0]?.value?.split('@')[0] || 'Usuário',
          };

          if (!googleUser.email) {
            return done(new Error('Email não fornecido pelo Google'));
          }

          // Estratégia de vinculação automática por email
          const user = await handleGoogleLogin(googleUser);
          
          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  // Serialização para sessão (não usamos sessão, mas é necessário)
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await db.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  console.log('[Google OAuth] Configurado com sucesso');
  return true;
}

/**
 * Lógica de vinculação automática de contas
 * OPÇÃO 1: Vinculação automática por email
 */
async function handleGoogleLogin(googleUser: {
  openId: string;
  email: string;
  name: string;
}) {
  // 1. Buscar usuário por email (identificador único)
  let user = await db.getUserByEmail(googleUser.email);

  if (user) {
    // CENÁRIO A: Email já existe - Vincular Google
    console.log(`[Google OAuth] Email encontrado: ${googleUser.email}. Vinculando Google...`);

    if (!user.openId) {
      // Primeira vez usando Google - vincular
      await db.linkGoogleToUser(user.id, googleUser.openId);
      console.log(`[Google OAuth] Google vinculado à conta de ${googleUser.email}`);
    } else {
      // Já tem Google vinculado - apenas atualizar último login
      await db.updateUserLastSignedIn(user.id);
    }

    // Recarregar usuário atualizado
    user = await db.getUserById(user.id);
  } else {
    // CENÁRIO B: Email não existe - Criar nova conta
    console.log(`[Google OAuth] Novo usuário: ${googleUser.email}. Criando conta...`);
    user = await db.createUserWithGoogle(googleUser);
    console.log(`[Google OAuth] Conta criada para ${googleUser.email}`);
  }

  return user;
}

/**
 * Gera JWT token para o usuário
 */
export function generateGoogleToken(user: any) {
  return generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
}

/**
 * Verifica se Google OAuth está configurado
 */
export function isGoogleOAuthEnabled(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
