import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@sistema-estoque.com';

/**
 * Envia email de boas-vindas com credenciais iniciais
 */
export async function sendWelcomeEmail(
  toEmail: string,
  name: string,
  password: string
): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: 'Bem-vindo ao Sistema de Gestão de Estoque',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Bem-vindo ao Sistema de Gestão de Estoque Inteligente</h2>
          
          <p>Olá <strong>${name}</strong>,</p>
          
          <p>Sua conta foi criada com sucesso! Use as credenciais abaixo para fazer login:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin: 5px 0;"><strong>Senha:</strong> ${password}</p>
          </div>
          
          <p><strong>⚠️ Importante:</strong> Guarde esta senha em local seguro. Se esquecer, você pode recuperá-la através da opção "Esqueci minha senha" na tela de login.</p>
          
          <p>Acesse o sistema em: <a href="${process.env.VITE_APP_URL || 'https://sistema-estoque-inteligente.onrender.com'}">${process.env.VITE_APP_URL || 'https://sistema-estoque-inteligente.onrender.com'}</a></p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #6b7280; font-size: 12px;">
            Este é um email automático. Por favor, não responda.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Erro ao enviar email de boas-vindas:', error);
      return false;
    }

    console.log('[Email] Email de boas-vindas enviado com sucesso:', data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Exceção ao enviar email de boas-vindas:', error);
    return false;
  }
}

/**
 * Envia email de recuperação de senha
 */
export async function sendPasswordRecoveryEmail(
  toEmail: string,
  name: string,
  password: string
): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: 'Recuperação de Senha - Sistema de Gestão de Estoque',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Recuperação de Senha</h2>
          
          <p>Olá <strong>${name}</strong>,</p>
          
          <p>Você solicitou a recuperação de senha. Sua senha atual é:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin: 5px 0;"><strong>Senha:</strong> ${password}</p>
          </div>
          
          <p><strong>⚠️ Importante:</strong> Guarde esta senha em local seguro. Se precisar alterá-la, entre em contato com o administrador do sistema.</p>
          
          <p>Acesse o sistema em: <a href="${process.env.VITE_APP_URL || 'https://sistema-estoque-inteligente.onrender.com'}">${process.env.VITE_APP_URL || 'https://sistema-estoque-inteligente.onrender.com'}</a></p>
          
          <p style="color: #dc2626; margin-top: 20px;">
            <strong>Não solicitou esta recuperação?</strong> Entre em contato com o administrador imediatamente.
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #6b7280; font-size: 12px;">
            Este é um email automático. Por favor, não responda.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Erro ao enviar email de recuperação:', error);
      return false;
    }

    console.log('[Email] Email de recuperação enviado com sucesso:', data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Exceção ao enviar email de recuperação:', error);
    return false;
  }
}

/**
 * Envia email de reset de senha (quando admin reseta senha de usuário)
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  name: string,
  newPassword: string
): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: 'Sua senha foi redefinida - Sistema de Gestão de Estoque',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Senha Redefinida</h2>
          
          <p>Olá <strong>${name}</strong>,</p>
          
          <p>Sua senha foi redefinida pelo administrador do sistema. Use a nova senha abaixo para fazer login:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin: 5px 0;"><strong>Nova Senha:</strong> ${newPassword}</p>
          </div>
          
          <p><strong>⚠️ Importante:</strong> Guarde esta senha em local seguro. Se esquecer, você pode recuperá-la através da opção "Esqueci minha senha" na tela de login.</p>
          
          <p>Acesse o sistema em: <a href="${process.env.VITE_APP_URL || 'https://sistema-estoque-inteligente.onrender.com'}">${process.env.VITE_APP_URL || 'https://sistema-estoque-inteligente.onrender.com'}</a></p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #6b7280; font-size: 12px;">
            Este é um email automático. Por favor, não responda.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Erro ao enviar email de reset:', error);
      return false;
    }

    console.log('[Email] Email de reset enviado com sucesso:', data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Exceção ao enviar email de reset:', error);
    return false;
  }
}
