import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { APP_LOGO, APP_TITLE } from '@/const';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();

  // Verificar se Google OAuth está habilitado
  const { data: googleStatus } = trpc.auth.googleStatus.useQuery();

  // Processar token do Google OAuth (callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (token && success === 'google_login') {
      // Armazenar token
      localStorage.setItem('auth_token', token);
      toast.success('Login com Google realizado com sucesso!');
      // Limpar URL
      window.history.replaceState({}, '', '/login');
      // Redirecionar
      setTimeout(() => setLocation('/'), 100);
    } else if (error) {
      toast.error('Erro ao fazer login com Google');
      window.history.replaceState({}, '', '/login');
    }
  }, [setLocation]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Armazenar token no localStorage (sessão persistente de 30 dias)
      localStorage.setItem('auth_token', data.token);
      toast.success('Login realizado com sucesso!');
      setLocation('/');
    },
    onError: (error) => {
      toast.error(error.message);
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    loginMutation.mutate(formData);
  };

  const handleGoogleLogin = () => {
    if (!googleStatus?.enabled) {
      toast.error('Google OAuth não configurado. Entre em contato com o administrador.');
      return;
    }
    // Redirecionar para endpoint do Google OAuth
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md p-8 shadow-xl">
        {/* Logo e Título */}
        <div className="text-center mb-8">
          {APP_LOGO && (
            <img
              src={APP_LOGO}
              alt={APP_TITLE}
              className="h-16 w-16 mx-auto mb-4"
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900">{APP_TITLE}</h1>
          <p className="text-gray-600 mt-2">Faça login para continuar</p>
        </div>

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="seu@email.com"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="password">Senha</Label>
              <Link href="/forgot-password">
                <button type="button" className="text-sm text-blue-600 hover:underline">
                  Esqueceu sua senha?
                </button>
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••"
              required
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Ou continue com</span>
          </div>
        </div>

        {/* Login com Google */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Login com Google
        </Button>

        {/* Link para Registro */}
        <p className="text-center mt-6 text-sm text-gray-600">
          Não tem uma conta?{' '}
          <button
            type="button"
            onClick={() => setLocation('/register')}
            className="text-blue-600 hover:underline font-medium"
            disabled={isLoading}
          >
            Criar conta
          </button>
        </p>
      </Card>
    </div>
  );
}
