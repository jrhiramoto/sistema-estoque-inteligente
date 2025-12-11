# Análise Detalhada: Autenticação Email/Senha

## Data: 05/01/2025

---

## 1. VISÃO GERAL

Sistema de autenticação tradicional baseado em email e senha, onde o usuário cria uma conta fornecendo email, senha e nome, e posteriormente faz login usando essas credenciais.

---

## 2. ARQUITETURA TÉCNICA

### 2.1. Componentes Necessários

#### Backend:
1. **Endpoints de Autenticação:**
   - `POST /api/auth/register` - Criar nova conta
   - `POST /api/auth/login` - Fazer login
   - `POST /api/auth/logout` - Fazer logout
   - `POST /api/auth/forgot-password` - Solicitar recuperação de senha
   - `POST /api/auth/reset-password` - Redefinir senha com token
   - `GET /api/auth/me` - Obter dados do usuário logado
   - `PATCH /api/auth/update-profile` - Atualizar perfil
   - `PATCH /api/auth/change-password` - Alterar senha

2. **Bibliotecas:**
   - `bcrypt` - Hash de senhas (já instalado)
   - `jsonwebtoken` - Geração de tokens JWT
   - `nodemailer` - Envio de emails
   - `crypto` - Geração de tokens de recuperação

3. **Banco de Dados:**
   - Tabela `users` já existe com campos:
     * `id`, `openId`, `name`, `email`, `loginMethod`, `role`, `createdAt`, `updatedAt`, `lastSignedIn`
   - **ADICIONAR campos:**
     * `passwordHash` - Hash da senha (VARCHAR 255)
     * `emailVerified` - Se email foi verificado (BOOLEAN, default false)
     * `emailVerificationToken` - Token de verificação (VARCHAR 255, nullable)
     * `passwordResetToken` - Token de recuperação (VARCHAR 255, nullable)
     * `passwordResetExpires` - Expiração do token (TIMESTAMP, nullable)

#### Frontend:
1. **Páginas:**
   - `/register` - Cadastro de nova conta
   - `/login` - Página de login
   - `/forgot-password` - Solicitar recuperação de senha
   - `/reset-password/:token` - Redefinir senha
   - `/verify-email/:token` - Verificar email

2. **Componentes:**
   - `RegisterForm` - Formulário de cadastro
   - `LoginForm` - Formulário de login
   - `ForgotPasswordForm` - Formulário de recuperação
   - `ResetPasswordForm` - Formulário de redefinição
   - `ProfileSettings` - Configurações de perfil

---

## 3. FLUXO DE IMPLEMENTAÇÃO

### 3.1. Cadastro de Nova Conta

```
1. Usuário acessa /register
   ↓
2. Preenche: Nome, Email, Senha, Confirmar Senha
   ↓
3. Frontend valida:
   - Email válido
   - Senha >= 8 caracteres
   - Senha == Confirmar Senha
   ↓
4. POST /api/auth/register
   ↓
5. Backend valida:
   - Email não existe no banco
   - Senha forte (letras, números, símbolos)
   ↓
6. Gera hash da senha com bcrypt (salt rounds: 10)
   ↓
7. Gera token de verificação de email (UUID)
   ↓
8. Salva usuário no banco:
   - passwordHash
   - emailVerified: false
   - emailVerificationToken
   ↓
9. Envia email de verificação
   ↓
10. Retorna sucesso (mas não loga automaticamente)
    ↓
11. Usuário recebe email e clica no link
    ↓
12. GET /api/auth/verify-email/:token
    ↓
13. Backend valida token e marca emailVerified: true
    ↓
14. Redireciona para /login com mensagem de sucesso
```

### 3.2. Login

```
1. Usuário acessa /login
   ↓
2. Preenche: Email, Senha
   ↓
3. POST /api/auth/login
   ↓
4. Backend busca usuário por email
   ↓
5. Verifica se email foi verificado
   ↓
6. Compara senha com hash usando bcrypt.compare()
   ↓
7. Se válido:
   - Gera JWT token (expira em 7 dias)
   - Atualiza lastSignedIn
   - Retorna token + dados do usuário
   ↓
8. Frontend armazena token no localStorage
   ↓
9. Redireciona para dashboard
```

### 3.3. Recuperação de Senha

```
1. Usuário acessa /forgot-password
   ↓
2. Preenche: Email
   ↓
3. POST /api/auth/forgot-password
   ↓
4. Backend busca usuário por email
   ↓
5. Gera token de recuperação (crypto.randomBytes)
   ↓
6. Salva token e expiração (1 hora) no banco
   ↓
7. Envia email com link de recuperação
   ↓
8. Usuário clica no link
   ↓
9. GET /reset-password/:token (frontend)
   ↓
10. Usuário preenche nova senha
    ↓
11. POST /api/auth/reset-password
    ↓
12. Backend valida:
    - Token existe
    - Token não expirou
    ↓
13. Gera novo hash da senha
    ↓
14. Atualiza senha e limpa tokens
    ↓
15. Redireciona para /login
```

---

## 4. CÓDIGO DE IMPLEMENTAÇÃO

### 4.1. Schema do Banco (drizzle/schema.ts)

```typescript
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // Nullable para email/senha
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  
  // Novos campos para email/senha
  passwordHash: varchar("passwordHash", { length: 255 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerificationToken: varchar("emailVerificationToken", { length: 255 }),
  passwordResetToken: varchar("passwordResetToken", { length: 255 }),
  passwordResetExpires: timestamp("passwordResetExpires"),
  
  loginMethod: varchar("loginMethod", { length: 64 }).notNull(), // "email" ou "google"
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
```

### 4.2. Backend - Registro (server/auth.ts)

```typescript
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendVerificationEmail } from './email';

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  // 1. Validar email único
  const existingUser = await db.getUserByEmail(data.email);
  if (existingUser) {
    throw new Error('Email já cadastrado');
  }

  // 2. Validar força da senha
  if (data.password.length < 8) {
    throw new Error('Senha deve ter no mínimo 8 caracteres');
  }

  // 3. Gerar hash da senha
  const passwordHash = await bcrypt.hash(data.password, 10);

  // 4. Gerar token de verificação
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');

  // 5. Criar usuário
  const user = await db.createUser({
    name: data.name,
    email: data.email,
    passwordHash,
    emailVerified: false,
    emailVerificationToken,
    loginMethod: 'email',
    role: 'user',
  });

  // 6. Enviar email de verificação
  await sendVerificationEmail(data.email, emailVerificationToken);

  return { success: true, message: 'Verifique seu email para ativar a conta' };
}
```

### 4.3. Backend - Login (server/auth.ts)

```typescript
import jwt from 'jsonwebtoken';

export async function loginUser(data: {
  email: string;
  password: string;
}) {
  // 1. Buscar usuário
  const user = await db.getUserByEmail(data.email);
  if (!user || !user.passwordHash) {
    throw new Error('Email ou senha incorretos');
  }

  // 2. Verificar se email foi verificado
  if (!user.emailVerified) {
    throw new Error('Por favor, verifique seu email antes de fazer login');
  }

  // 3. Comparar senha
  const isValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isValid) {
    throw new Error('Email ou senha incorretos');
  }

  // 4. Gerar JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  // 5. Atualizar último login
  await db.updateLastSignedIn(user.id);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}
```

### 4.4. Backend - Recuperação de Senha (server/auth.ts)

```typescript
export async function forgotPassword(email: string) {
  // 1. Buscar usuário
  const user = await db.getUserByEmail(email);
  if (!user) {
    // Não revelar se email existe (segurança)
    return { success: true, message: 'Se o email existir, você receberá instruções' };
  }

  // 2. Gerar token de recuperação
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 3600000); // 1 hora

  // 3. Salvar token
  await db.updateUser(user.id, {
    passwordResetToken: resetToken,
    passwordResetExpires: resetExpires,
  });

  // 4. Enviar email
  await sendPasswordResetEmail(email, resetToken);

  return { success: true, message: 'Instruções enviadas para seu email' };
}

export async function resetPassword(token: string, newPassword: string) {
  // 1. Buscar usuário por token
  const user = await db.getUserByResetToken(token);
  if (!user || !user.passwordResetExpires) {
    throw new Error('Token inválido ou expirado');
  }

  // 2. Verificar expiração
  if (new Date() > user.passwordResetExpires) {
    throw new Error('Token expirado');
  }

  // 3. Gerar novo hash
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // 4. Atualizar senha e limpar tokens
  await db.updateUser(user.id, {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
  });

  return { success: true, message: 'Senha redefinida com sucesso' };
}
```

### 4.5. Backend - Envio de Emails (server/email.ts)

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${process.env.APP_URL}/verify-email/${token}`;
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Verifique seu email - Sistema de Estoque',
    html: `
      <h1>Bem-vindo ao Sistema de Estoque Inteligente!</h1>
      <p>Clique no link abaixo para verificar seu email:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>Este link expira em 24 horas.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.APP_URL}/reset-password/${token}`;
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Recuperação de senha - Sistema de Estoque',
    html: `
      <h1>Recuperação de Senha</h1>
      <p>Você solicitou recuperação de senha. Clique no link abaixo:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>Este link expira em 1 hora.</p>
      <p>Se você não solicitou, ignore este email.</p>
    `,
  });
}
```

### 4.6. Frontend - Página de Registro (client/src/pages/Register.tsx)

```tsx
import { useState } from 'react';
import { useNavigate } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [, navigate] = useNavigate();
  
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success('Conta criada! Verifique seu email.');
      navigate('/login');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações frontend
    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    if (formData.password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres');
      return;
    }
    
    registerMutation.mutate({
      name: formData.name,
      email: formData.email,
      password: formData.password,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Criar Conta</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <p className="text-sm text-gray-500 mt-1">Mínimo 8 caracteres</p>
          </div>
          
          <div>
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={registerMutation.isLoading}
          >
            {registerMutation.isLoading ? 'Criando conta...' : 'Criar Conta'}
          </Button>
        </form>
        
        <p className="text-center mt-4 text-sm">
          Já tem uma conta?{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            Fazer login
          </a>
        </p>
      </Card>
    </div>
  );
}
```

### 4.7. Frontend - Página de Login (client/src/pages/Login.tsx)

```tsx
import { useState } from 'react';
import { useNavigate } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [, navigate] = useNavigate();
  
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      toast.success('Login realizado com sucesso!');
      navigate('/');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Entrar</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>
          
          <div className="text-right">
            <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
              Esqueceu a senha?
            </a>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={loginMutation.isLoading}
          >
            {loginMutation.isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        
        <p className="text-center mt-4 text-sm">
          Não tem uma conta?{' '}
          <a href="/register" className="text-blue-600 hover:underline">
            Criar conta
          </a>
        </p>
      </Card>
    </div>
  );
}
```

---

## 5. CONFIGURAÇÃO SMTP

### 5.1. Opções de Serviço de Email

#### Opção 1: Gmail (Gratuito, Fácil)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
SMTP_FROM="Sistema de Estoque <seu-email@gmail.com>"
```

**Como configurar:**
1. Ativar "Verificação em 2 etapas" no Gmail
2. Gerar "Senha de app" em https://myaccount.google.com/apppasswords
3. Usar a senha gerada no SMTP_PASS

**Limitações:**
- 500 emails/dia (suficiente para maioria dos casos)

#### Opção 2: SendGrid (Gratuito até 100 emails/dia)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=sua-api-key
SMTP_FROM="Sistema de Estoque <noreply@seudominio.com>"
```

#### Opção 3: Mailgun (Gratuito até 5.000 emails/mês)
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@seu-dominio.mailgun.org
SMTP_PASS=sua-senha
SMTP_FROM="Sistema de Estoque <noreply@seudominio.com>"
```

---

## 6. SEGURANÇA

### 6.1. Boas Práticas Implementadas

✅ **Hash de senhas com bcrypt** (salt rounds: 10)
✅ **Tokens de verificação únicos** (crypto.randomBytes)
✅ **Expiração de tokens** (1 hora para reset, 24h para verificação)
✅ **JWT com expiração** (7 dias)
✅ **Validação de força de senha** (mínimo 8 caracteres)
✅ **Rate limiting** (prevenir brute force)
✅ **HTTPS obrigatório** (Railway fornece automaticamente)
✅ **Não revelar se email existe** (em forgot-password)

### 6.2. Melhorias Opcionais

- 🔒 Autenticação de 2 fatores (2FA)
- 🔒 Captcha em registro/login
- 🔒 Bloqueio de conta após N tentativas falhas
- 🔒 Histórico de logins
- 🔒 Notificação de login em novo dispositivo

---

## 7. COMPARAÇÃO: EMAIL/SENHA vs GOOGLE OAUTH

| Aspecto | Email/Senha | Google OAuth |
|---------|-------------|--------------|
| **Tempo de Implementação** | 6-8 horas | 2-3 horas |
| **Complexidade** | Alta | Média |
| **UX** | 3-4 passos (registro + verificação + login) | 1 clique |
| **Segurança** | Responsabilidade nossa | Gerenciada pelo Google |
| **Manutenção** | Alta (emails, tokens, recuperação) | Baixa |
| **Dependência Externa** | SMTP (Gmail, SendGrid) | Google |
| **Custo** | Gratuito (até limite SMTP) | Gratuito (ilimitado) |
| **Usuários sem Gmail** | ✅ Funciona | ❌ Não funciona |
| **Controle Total** | ✅ Sim | ⚠️ Parcial |
| **Esqueceu a senha** | Precisa implementar | Não aplicável |
| **Verificação de email** | Precisa implementar | Automático |

---

## 8. ESTIMATIVAS DETALHADAS

### 8.1. Tempo de Desenvolvimento

| Tarefa | Tempo |
|--------|-------|
| Atualizar schema do banco | 30 min |
| Implementar endpoints backend | 2 horas |
| Configurar SMTP | 30 min |
| Implementar envio de emails | 1 hora |
| Criar páginas frontend (Register, Login, Forgot, Reset) | 2 horas |
| Implementar proteção de rotas | 30 min |
| Testes | 1 hora |
| **TOTAL** | **7-8 horas** |

### 8.2. Custo Operacional

**Gratuito** se usar:
- Gmail (até 500 emails/dia)
- SendGrid Free (até 100 emails/dia)
- Mailgun Free (até 5.000 emails/mês)

---

## 9. RECOMENDAÇÃO

### Se você precisa de:

✅ **Google OAuth** se:
- Quer implementação rápida (2-3h)
- Público-alvo tem Gmail
- Prefere menos responsabilidade de segurança
- Quer melhor UX

✅ **Email/Senha** se:
- Precisa controle total
- Usuários podem não ter Gmail
- Quer independência de terceiros
- Não se importa com complexidade adicional

✅ **Sistema Híbrido (IDEAL)** se:
- Quer oferecer flexibilidade
- Tem tempo para implementar ambos (8-10h total)
- Quer maximizar alcance de usuários

---

## 10. PRÓXIMOS PASSOS

Se optar por **Email/Senha**, preciso:

1. ✅ Atualizar schema do banco (adicionar campos de senha)
2. ✅ Aplicar migração
3. ✅ Configurar SMTP (Gmail, SendGrid ou Mailgun)
4. ✅ Implementar endpoints backend
5. ✅ Implementar páginas frontend
6. ✅ Configurar variáveis de ambiente no Railway
7. ✅ Testar fluxo completo
8. ✅ Fazer deploy

**Deseja que eu implemente o sistema Email/Senha?** 🔐
