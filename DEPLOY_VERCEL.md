# 🚀 Guia de Deploy no Vercel

## Pré-requisitos

- Conta no GitHub (com repositório do projeto)
- Conta no Vercel (gratuita) - https://vercel.com
- Banco de dados PostgreSQL (Railway ou outro)

---

## Passo 1: Criar Conta no Vercel

1. Acesse: https://vercel.com
2. Clique em **"Sign Up"**
3. Escolha **"Continue with GitHub"**
4. Autorize o Vercel a acessar seus repositórios

---

## Passo 2: Importar Projeto

1. No dashboard do Vercel, clique em **"Add New..."** → **"Project"**
2. Procure pelo repositório `sistema-estoque-inteligente`
3. Clique em **"Import"**

---

## Passo 3: Configurar Projeto

### Build & Development Settings:

- **Framework Preset**: Other
- **Root Directory**: `./` (deixe vazio)
- **Build Command**: `pnpm build`
- **Output Directory**: `dist/public`
- **Install Command**: `pnpm install`

### Environment Variables:

Adicione as seguintes variáveis de ambiente:

```
DATABASE_URL=postgresql://...  (do Railway)
JWT_SECRET=seu-secret-aqui-minimo-32-caracteres
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@seudominio.com
NODE_ENV=production
```

**Importante:** Copie o `DATABASE_URL` do seu banco PostgreSQL (Railway ou outro).

---

## Passo 4: Deploy

1. Clique em **"Deploy"**
2. Aguarde 3-5 minutos (build + deploy)
3. Vercel mostrará a URL do projeto: `https://sistema-estoque-inteligente.vercel.app`

---

## Passo 5: Aplicar Migrações do Banco

Após o primeiro deploy bem-sucedido:

1. No dashboard do Vercel, vá em **Settings** → **Functions**
2. Ou acesse diretamente o banco e execute:

```sql
-- As migrações serão aplicadas automaticamente na primeira execução
-- O Drizzle ORM cria as tabelas necessárias
```

---

## Passo 6: Criar Usuário Master

1. Acesse: `https://sistema-estoque-inteligente.vercel.app/setup`
2. Preencha o formulário:
   - Nome completo
   - Email
   - Senha (mínimo 6 caracteres)
   - Confirmar senha
3. Clique em **"Criar Usuário Master"**
4. Faça login com as credenciais criadas

---

## Configurações Adicionais

### Domínio Customizado (Opcional)

1. No Vercel, vá em **Settings** → **Domains**
2. Adicione seu domínio personalizado
3. Configure DNS conforme instruções

### Deploy Automático

O Vercel já está configurado para:
- ✅ Deploy automático a cada push na branch `main`
- ✅ Preview deploys para pull requests
- ✅ Rollback instantâneo se necessário

---

## Troubleshooting

### Erro de Build

Se o build falhar:
1. Verifique os logs no dashboard Vercel
2. Certifique-se de que todas as variáveis de ambiente estão configuradas
3. Verifique se o `DATABASE_URL` está correto

### Erro de Conexão com Banco

1. Verifique se o Railway/PostgreSQL está ativo
2. Confirme que o `DATABASE_URL` está correto
3. Verifique se o banco permite conexões externas

### Página em Branco

1. Abra o console do navegador (F12)
2. Verifique erros de JavaScript
3. Confirme que as variáveis de ambiente estão corretas

---

## Suporte

- Documentação Vercel: https://vercel.com/docs
- Suporte Vercel: https://vercel.com/support
