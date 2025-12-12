import { useState } from 'react';
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
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
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

        {/* Link de Recuperação de Senha */}
        <div className="mt-6 text-center">
          <Link href="/forgot-password">
            <a className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
              Esqueci minha senha
            </a>
          </Link>
        </div>

        {/* Informação de Contato */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Não tem acesso? Entre em contato com o administrador do sistema.
          </p>
        </div>
      </Card>
    </div>
  );
}
