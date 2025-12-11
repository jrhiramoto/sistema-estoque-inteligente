# 🚀 Guia Completo: Configurar Google OAuth

Você já criou o projeto "Sistema Estoque Inteligente" no Google Cloud Console! Agora vamos configurar o OAuth em 3 passos simples.

---

## 📍 **ONDE VOCÊ ESTÁ AGORA**

Você está na página de **Branding** do Google Auth Platform:
```
https://console.cloud.google.com/auth/branding?project=sistema-estoque-inteligente
```

---

## 🎯 **PASSO 1: Configurar Branding (Tela de Consentimento)**

### **1.1 Preencher informações básicas:**

Na página de Branding, você verá um formulário. Preencha:

**Campos obrigatórios:**
- **Nome do app:** `Sistema Estoque Inteligente`
- **E-mail de suporte do usuário:** Seu email (edgardhiramoto@gmail.com)

**Campos opcionais (pode pular):**
- Logo do app
- Link da página inicial do app
- Link da política de privacidade
- Link dos termos de serviço

### **1.2 Salvar:**
- Clique em **"Salvar"** ou **"Salvar e continuar"** no final da página

---

## 🎯 **PASSO 2: Configurar Público-alvo**

### **2.1 Ir para Público-alvo:**
- No menu lateral esquerdo, clique em **"Público-alvo"**

### **2.2 Escolher tipo de usuário:**

Você verá 2 opções:

**Opção A: Interno** (recomendado para uso interno da empresa)
- ✅ Apenas usuários da sua organização Google Workspace
- ✅ Não precisa de verificação do Google
- ❌ Requer Google Workspace (pago)

**Opção B: Externo** (recomendado para você)
- ✅ Qualquer pessoa com conta Google
- ✅ Funciona com contas Gmail gratuitas
- ✅ **ESCOLHA ESTA OPÇÃO**
- ⚠️ Modo "Teste" permite até 100 usuários (suficiente para uso interno)

### **2.3 Selecionar:**
- Marque **"Externo"**
- Clique em **"Criar"** ou **"Salvar e continuar"**

---

## 🎯 **PASSO 3: Criar Credenciais OAuth**

### **3.1 Ir para Clientes:**
- No menu lateral esquerdo, clique em **"Clientes"**

### **3.2 Criar novo cliente OAuth:**
- Clique no botão **"+ Criar cliente OAuth"** ou **"Criar credenciais"**

### **3.3 Escolher tipo:**
- Selecione: **"Aplicativo da Web"**

### **3.4 Configurar cliente:**

**Nome:**
```
Sistema Estoque Inteligente - Web Client
```

**Origens JavaScript autorizadas:**
```
http://localhost:3000
https://3000-i047rwg307amdo1c5ytwb-5371ccb7.manusvm.computer
```

**URIs de redirecionamento autorizados:**
```
http://localhost:3000/api/auth/google/callback
https://3000-i047rwg307amdo1c5ytwb-5371ccb7.manusvm.computer/api/auth/google/callback
```

### **3.5 Criar:**
- Clique em **"Criar"**

---

## 🎉 **PASSO 4: Copiar Credenciais**

Após criar, aparecerá um modal com:

```
ID do cliente:
1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com

Chave secreta do cliente:
GOCSPX-abcdefghijklmnopqrstuvwxyz
```

### **4.1 Copiar credenciais:**
- ✅ Copie o **ID do cliente** (Client ID)
- ✅ Copie a **Chave secreta** (Client Secret)

### **4.2 Cole aqui no chat:**
Envie para mim no formato:

```
GOOGLE_CLIENT_ID=seu-client-id-aqui
GOOGLE_CLIENT_SECRET=seu-client-secret-aqui
```

---

## ⚠️ **IMPORTANTE**

### **URLs de Callback:**

Quando você fizer deploy no Railway (produção), precisará adicionar mais URIs:

**Adicionar depois do deploy:**
```
https://seu-dominio-railway.up.railway.app
https://seu-dominio-railway.up.railway.app/api/auth/google/callback
```

**Como adicionar:**
1. Volte para Google Cloud Console
2. Clique em "Clientes"
3. Clique no cliente criado
4. Adicione as novas URLs
5. Salve

---

## 🔧 **ATALHOS ÚTEIS**

### **Voltar para configuração:**
```
https://console.cloud.google.com/auth/overview?project=sistema-estoque-inteligente
```

### **Ver credenciais criadas:**
```
https://console.cloud.google.com/auth/clients?project=sistema-estoque-inteligente
```

---

## ❓ **DÚVIDAS FREQUENTES**

**P: Preciso ativar faturamento?**
R: NÃO! OAuth é 100% gratuito.

**P: Preciso verificar o app?**
R: NÃO para uso interno. Modo "Teste" permite 100 usuários.

**P: Posso usar meu Gmail pessoal?**
R: SIM! Funciona perfeitamente.

**P: E se eu errar algo?**
R: Sem problema! Pode editar tudo depois.

**P: Quanto tempo leva?**
R: 5-10 minutos no máximo.

---

## 🚀 **PRÓXIMOS PASSOS**

Depois de me enviar as credenciais:

1. ✅ Vou configurar no sistema
2. ✅ Vou testar o login com Google
3. ✅ Vou criar um checkpoint
4. ✅ Sistema estará pronto para uso!

---

**Qualquer dúvida, me pergunte! Estou aqui para ajudar.** 😊
