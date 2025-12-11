/**
 * Express routes para Google OAuth
 * Não pode ser implementado via tRPC pois usa redirecionamento HTTP
 */

import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateGoogleToken, isGoogleOAuthEnabled } from './googleOAuth';

const router = Router();

/**
 * GET /api/auth/google
 * Inicia o fluxo de autenticação com Google
 */
router.get('/google', (req: Request, res: Response, next) => {
  if (!isGoogleOAuthEnabled()) {
    return res.status(503).json({
      error: 'Google OAuth não configurado',
      message: 'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET',
    });
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

/**
 * GET /api/auth/google/callback
 * Callback do Google OAuth - processa resposta e redireciona
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/login?error=google_auth_failed' 
  }),
  (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      if (!user) {
        return res.redirect('/login?error=no_user');
      }

      // Gerar token JWT
      const token = generateGoogleToken(user);

      // Redirecionar para frontend com token
      // Frontend vai salvar no localStorage
      const redirectUrl = `/login?token=${encodeURIComponent(token)}&success=google_login`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('[Google OAuth] Erro no callback:', error);
      res.redirect('/login?error=callback_failed');
    }
  }
);

export default router;
