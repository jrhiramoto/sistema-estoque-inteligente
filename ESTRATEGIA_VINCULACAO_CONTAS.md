# Estratégia de Vinculação de Contas (Account Linking)

## 🤔 **O PROBLEMA**

**Cenário 1:**
- Usuário cria conta com email `joao@empresa.com` e senha
- Depois tenta fazer login com Google usando o mesmo email `joao@empresa.com`
- O que acontece?

**Cenário 2:**
- Usuário faz login com Google usando `joao@empresa.com`
- Depois tenta criar conta com email/senha usando o mesmo `joao@empresa.com`
- O que acontece?

---

## 🎯 **OPÇÕES DE IMPLEMENTAÇÃO**

### **Opção 1: Vinculação Automática por Email (RECOMENDADO)**

**Como funciona:**
- O sistema usa o **email como identificador único**
- Se o email já existe, vincula automaticamente os métodos de login
- Um usuário pode ter múltiplos métodos de login (email+senha E Google)

**Fluxo:**

```
1. Usuário cria conta com joao@empresa.com + senha
   → Banco: { email: "joao@...", passwordHash: "...", loginMethod: "email" }

2. Usuário faz login com Google (mesmo email)
   → Sistema detecta que email já existe
   → Atualiza registro: { email: "joao@...", passwordHash: "...", openId: "google123", loginMethod: "email,google" }
   → Login bem-sucedido

3. Próximos logins:
   → Pode usar email+senha OU Google
   → Ambos acessam a mesma conta
```

**Vantagens:**
✅ UX excelente - usuário não precisa lembrar qual método usou
✅ Flexibilidade - pode usar qualquer método
✅ Simples de implementar
✅ Ideal para uso interno (empresa)

**Desvantagens:**
⚠️ Requer que o email do Google seja verificado (Google já faz isso)
⚠️ Pode causar confusão se usuário não souber que vinculou

---

### **Opção 2: Contas Separadas (NÃO RECOMENDADO)**

**Como funciona:**
- Cada método de login cria uma conta separada
- Mesmo email pode ter 2 contas diferentes

**Fluxo:**

```
1. Usuário cria conta com joao@empresa.com + senha
   → Conta A criada

2. Usuário faz login com Google (mesmo email)
   → Conta B criada (separada)

3. Resultado:
   → 2 contas diferentes para o mesmo usuário
   → Dados não compartilhados
```

**Vantagens:**
✅ Simples de implementar
✅ Sem risco de vinculação acidental

**Desvantagens:**
❌ UX ruim - usuário confuso com 2 contas
❌ Dados duplicados
❌ Não faz sentido para uso interno

---

### **Opção 3: Vinculação Manual com Confirmação**

**Como funciona:**
- Sistema detecta email duplicado
- Pede para usuário confirmar vinculação
- Usuário precisa provar que é dono da conta (senha ou link no email)

**Fluxo:**

```
1. Usuário cria conta com joao@empresa.com + senha
   → Conta criada

2. Usuário tenta login com Google (mesmo email)
   → Sistema detecta email existente
   → Mostra: "Já existe uma conta com este email. Deseja vincular?"
   → Usuário digita senha atual para confirmar
   → Contas vinculadas

3. Resultado:
   → Uma conta com 2 métodos de login
```

**Vantagens:**
✅ Mais seguro - requer confirmação
✅ Usuário tem controle
✅ Transparente

**Desvantagens:**
⚠️ UX mais complexa - passo extra
⚠️ Mais código para implementar

---

## 🏆 **RECOMENDAÇÃO PARA SEU CASO**

### **Opção 1: Vinculação Automática por Email**

**Por quê?**
1. ✅ **Uso interno** - Todos são da mesma empresa, confiança alta
2. ✅ **UX simples** - Usuário não precisa pensar
3. ✅ **Flexibilidade** - Pode usar qualquer método
4. ✅ **Google já valida email** - Segurança garantida

---

## 📋 **IMPLEMENTAÇÃO TÉCNICA**

### **Schema do Banco (Atual)**

```typescript
{
  id: number,
  email: string UNIQUE,        // Identificador único
  openId: string | null,       // ID do Google (nullable)
  passwordHash: string | null, // Hash da senha (nullable)
  loginMethod: string,         // "email" | "google" | "email,google"
  name: string,
  role: string,
  ...
}
```

### **Lógica de Login com Google**

```typescript
// 1. Receber dados do Google
const googleUser = {
  email: "joao@empresa.com",
  openId: "google_123456",
  name: "João Silva"
};

// 2. Buscar usuário por email
const existingUser = await getUserByEmail(googleUser.email);

if (existingUser) {
  // CENÁRIO A: Email já existe (vinculação automática)
  
  if (!existingUser.openId) {
    // Primeira vez usando Google - vincular
    await updateUser(existingUser.id, {
      openId: googleUser.openId,
      loginMethod: existingUser.loginMethod + ",google"
    });
  }
  
  // Login bem-sucedido
  return generateToken(existingUser);
  
} else {
  // CENÁRIO B: Novo usuário - criar conta
  const newUser = await createUserWithGoogle(googleUser);
  return generateToken(newUser);
}
```

### **Lógica de Registro com Email/Senha**

```typescript
// 1. Receber dados do formulário
const formData = {
  email: "joao@empresa.com",
  password: "senha123",
  name: "João Silva"
};

// 2. Buscar usuário por email
const existingUser = await getUserByEmail(formData.email);

if (existingUser) {
  // CENÁRIO A: Email já existe
  
  if (existingUser.openId && !existingUser.passwordHash) {
    // Usuário criado via Google, agora quer adicionar senha
    const hash = await hashPassword(formData.password);
    await updateUser(existingUser.id, {
      passwordHash: hash,
      loginMethod: existingUser.loginMethod + ",email"
    });
    return { success: true, message: "Senha adicionada com sucesso!" };
  } else {
    // Email já tem senha cadastrada
    throw new Error("Email já cadastrado");
  }
  
} else {
  // CENÁRIO B: Novo usuário - criar conta
  const newUser = await createUserWithPassword(formData);
  return generateToken(newUser);
}
```

---

## 🔄 **FLUXOS COMPLETOS**

### **Fluxo 1: Email/Senha → Google**

```
1. Usuário cria conta
   POST /api/auth/register
   { email: "joao@...", password: "123456", name: "João" }
   → Banco: { email, passwordHash, loginMethod: "email" }

2. Usuário faz login com Google
   GET /api/auth/google/callback
   → Google retorna: { email: "joao@...", openId: "google123" }
   → Sistema busca por email: ENCONTRADO
   → Atualiza: { openId: "google123", loginMethod: "email,google" }
   → Login bem-sucedido

3. Próximos logins
   → Pode usar email+senha OU Google
```

### **Fluxo 2: Google → Email/Senha**

```
1. Usuário faz login com Google
   GET /api/auth/google/callback
   → Google retorna: { email: "joao@...", openId: "google123" }
   → Sistema busca por email: NÃO ENCONTRADO
   → Cria: { email, openId, loginMethod: "google" }

2. Usuário quer adicionar senha (opcional)
   POST /api/auth/add-password
   { password: "123456" }
   → Sistema busca usuário logado
   → Atualiza: { passwordHash: "...", loginMethod: "google,email" }

3. Próximos logins
   → Pode usar Google OU email+senha
```

---

## ⚠️ **CASOS ESPECIAIS**

### **Caso 1: Email do Google diferente do email cadastrado**

```
Usuário cadastrado: joao@empresa.com
Google retorna: joao.silva@gmail.com

→ São emails diferentes
→ Sistema cria nova conta
→ Usuário tem 2 contas (esperado)
```

**Solução:** Usuário pode vincular manualmente depois (feature futura)

### **Caso 2: Usuário esqueceu que já tem conta**

```
1. Usuário criou conta com email+senha há 6 meses
2. Esqueceu e tenta criar nova conta com Google
3. Sistema detecta email duplicado e vincula automaticamente
4. Usuário acessa a conta antiga (com todos os dados)

→ Comportamento correto!
```

### **Caso 3: Múltiplos usuários com mesmo email (impossível)**

```
Banco tem constraint UNIQUE no email
→ Impossível ter 2 registros com mesmo email
→ Sempre vai vincular ou dar erro
```

---

## 🎯 **DECISÃO FINAL**

### **Implementar: Vinculação Automática por Email**

**Motivos:**
1. ✅ Melhor UX para uso interno
2. ✅ Simples de implementar
3. ✅ Flexível para o usuário
4. ✅ Seguro (Google valida email)

**Comportamento:**
- Email é o identificador único
- Usuário pode ter múltiplos métodos de login
- Vinculação automática e transparente
- Sem confirmação necessária (confiança interna)

---

## 📝 **ALTERAÇÕES NECESSÁRIAS NO CÓDIGO**

### **1. Atualizar `loginMethod` para suportar múltiplos valores**

```typescript
// Antes: "email" | "google"
// Depois: "email" | "google" | "email,google"
```

### **2. Criar função de atualização de usuário**

```typescript
export async function updateUserLoginMethod(
  userId: number, 
  updates: { openId?: string; passwordHash?: string; loginMethod: string }
): Promise<void>
```

### **3. Atualizar lógica de Google OAuth**

- Buscar por email antes de criar
- Se encontrar, vincular openId
- Se não encontrar, criar novo

### **4. Atualizar lógica de registro**

- Buscar por email antes de criar
- Se encontrar com Google, permitir adicionar senha
- Se encontrar com senha, dar erro

---

## 🧪 **TESTES**

### **Cenários para testar:**

1. ✅ Criar conta com email+senha → Login com Google (mesmo email)
2. ✅ Login com Google → Tentar criar conta com email+senha (mesmo email)
3. ✅ Criar conta com email+senha → Login com email+senha
4. ✅ Login com Google → Login com Google novamente
5. ✅ Emails diferentes → Contas separadas (esperado)

---

**Quer que eu implemente essa estratégia?** 🚀
