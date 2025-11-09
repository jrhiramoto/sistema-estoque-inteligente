import axios from "axios";
import * as db from "./db";
const BLING_API_URL = "https://api.bling.com.br/Api/v3";
const BLING_OAUTH_URL = "https://www.bling.com.br/Api/v3/oauth/token";

// Rate limiting: delay entre requisições (em ms)
const REQUEST_DELAY_MS = 500; // 500ms = 2 requisições por segundo

/**
 * Aguarda um tempo antes de continuar
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface BlingTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token: string;
}

interface BlingProduct {
  id: number;
  codigo?: string;
  nome: string;
  descricaoCurta?: string;
  preco: number;
  precoCusto?: number;
  unidade?: string;
}

interface BlingEstoque {
  produto: {
    id: number;
  };
  deposito?: {
    id: number;
    nome: string;
  };
  saldoVirtualTotal: number;
  saldoFisicoTotal: number;
}

interface BlingPedido {
  id: number;
  numero: string;
  data: string;
  itens: Array<{
    produto: {
      id: number;
    };
    quantidade: number;
    valor: number;
  }>;
}

/**
 * Troca authorization code por access token e refresh token
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<BlingTokenResponse> {
  try {
    const response = await axios.post(
      BLING_OAUTH_URL,
      {
        grant_type: "authorization_code",
        code,
      },
      {
        auth: {
          username: clientId,
          password: clientSecret,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Erro ao trocar code por token:", error.response?.data || error.message);
    throw new Error("Falha ao obter token do Bling");
  }
}

/**
 * Atualiza access token usando refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<BlingTokenResponse> {
  try {
    const response = await axios.post(
      BLING_OAUTH_URL,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
      {
        auth: {
          username: clientId,
          password: clientSecret,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Erro ao renovar token:", error.response?.data || error.message);
    throw new Error("Falha ao renovar token do Bling");
  }
}

/**
 * Verifica se o token está expirado e renova se necessário
 */
export async function ensureValidToken(userId: number): Promise<string> {
  const config = await db.getBlingConfig(userId);
  
  if (!config || !config.accessToken) {
    throw new Error("Configuração do Bling não encontrada");
  }

  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error("Credenciais do Bling incompletas");
  }

  // Verifica se o token está expirado (com margem de 5 minutos)
  const now = new Date();
  const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt) : new Date(0);
  const marginMs = 5 * 60 * 1000; // 5 minutos

  if (now.getTime() + marginMs >= expiresAt.getTime()) {
    // Token expirado, renovar
    const newToken = await refreshAccessToken(
      config.refreshToken,
      config.clientId,
      config.clientSecret
    );

    // Atualizar no banco
    const newExpiresAt = new Date(Date.now() + newToken.expires_in * 1000);
    await db.upsertBlingConfig({
      userId,
      accessToken: newToken.access_token,
      refreshToken: newToken.refresh_token,
      tokenExpiresAt: newExpiresAt,
      isActive: true,
    });

    return newToken.access_token;
  }

  return config.accessToken;
}

/**
 * Faz requisição autenticada para a API do Bling
 */
async function blingRequest<T>(
  userId: number,
  endpoint: string,
  method: "GET" | "POST" = "GET",
  data?: any
): Promise<T> {
  const token = await ensureValidToken(userId);

  try {
    console.log(`[Bling API] ${method} ${BLING_API_URL}${endpoint}`);
    const response = await axios({
      method,
      url: `${BLING_API_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      data,
    });

    console.log(`[Bling API] Sucesso: ${method} ${endpoint}`);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    const errorMessage = errorData?.error?.message || errorData?.message || error.message;
    
    console.error(`[Bling API] Erro ${status} em ${endpoint}:`, {
      status,
      message: errorMessage,
      data: errorData,
      url: `${BLING_API_URL}${endpoint}`,
    });
    
    throw new Error(`Falha ao acessar API do Bling (${status}): ${errorMessage}`);
  }
}

/**
 * Sincroniza produtos do Bling
 */
export async function syncProducts(userId: number): Promise<{ synced: number; errors: number }> {
  try {
    const response = await blingRequest<{ data: BlingProduct[] }>(userId, "/produtos");
    const products = response.data || [];

    let synced = 0;
    let errors = 0;

    for (const blingProduct of products) {
      try {
        await db.upsertProduct({
          blingId: String(blingProduct.id),
          code: blingProduct.codigo || null,
          name: blingProduct.nome,
          description: blingProduct.descricaoCurta || null,
          price: Math.round(blingProduct.preco * 100), // converter para centavos
          cost: Math.round((blingProduct.precoCusto || 0) * 100),
          unit: blingProduct.unidade || null,
        });
        synced++;
      } catch (error) {
        console.error(`Erro ao sincronizar produto ${blingProduct.id}:`, error);
        errors++;
      }
    }

    return { synced, errors };
  } catch (error) {
    console.error("Erro ao sincronizar produtos:", error);
    throw error;
  }
}

/**
 * Sincroniza estoque do Bling
 */
export async function syncInventory(userId: number): Promise<{ synced: number; errors: number }> {
  try {
    // Primeiro, buscar todos os produtos do banco local
    const products = await db.getAllProducts();
    
    if (products.length === 0) {
      console.log("[Bling] Nenhum produto encontrado. Sincronize produtos primeiro.");
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    // Processar produtos em lotes para respeitar rate limit
    const BATCH_SIZE = 10; // Processar 10 produtos por vez
    
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      
      // Criar array de IDs para buscar em uma única requisição
      const productIds = batch
        .filter(p => p.blingId)
        .map(p => p.blingId)
        .join(',');
      
      if (!productIds) continue;
      
      try {
        // Buscar estoque de múltiplos produtos de uma vez
        const response = await blingRequest<{ data: BlingEstoque[] }>(
          userId,
          `/estoques/saldos?idsProdutos=${productIds}`
        );
        
        const estoques = response.data || [];
        
        // Mapear estoques aos produtos
        for (const estoque of estoques) {
          const product = batch.find(p => p.blingId === String(estoque.produto.id));
          
          if (product) {
            try {
              await db.upsertInventory({
                productId: product.id,
                depositId: estoque.deposito?.id ? String(estoque.deposito.id) : "default",
                depositName: estoque.deposito?.nome || "Depósito Principal",
                virtualStock: Math.round(estoque.saldoVirtualTotal || 0),
                physicalStock: Math.round(estoque.saldoFisicoTotal || 0),
                lastVirtualSync: new Date(),
              });
              synced++;
            } catch (error: any) {
              console.error(`Erro ao salvar estoque do produto ${product.blingId}:`, error.message);
              errors++;
            }
          }
        }
        
        // Aguardar antes da próxima requisição (rate limiting)
        if (i + BATCH_SIZE < products.length) {
          await delay(REQUEST_DELAY_MS);
        }
      } catch (error: any) {
        console.error(`Erro ao sincronizar lote de produtos:`, error.message);
        errors += batch.length;
      }
    }

    return { synced, errors };
  } catch (error) {
    console.error("Erro ao sincronizar estoque:", error);
    throw error;
  }
}

/**
 * Sincroniza vendas do Bling (últimos 30 dias)
 */
export async function syncSales(userId: number): Promise<{ synced: number; errors: number }> {
  try {
    // Buscar pedidos dos últimos 30 dias
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - 30);
    const dataFinal = new Date();

    const response = await blingRequest<{ data: BlingPedido[] }>(
      userId,
      `/pedidos/vendas?dataInicial=${dataInicial.toISOString().split('T')[0]}&dataFinal=${dataFinal.toISOString().split('T')[0]}`
    );
    
    const pedidos = response.data || [];

    let synced = 0;
    let errors = 0;

    for (const pedido of pedidos) {
      for (const item of pedido.itens) {
        try {
          // Buscar produto pelo blingId
          const product = await db.getProductByBlingId(String(item.produto.id));
          
          if (product) {
            await db.insertSale({
              blingOrderId: String(pedido.id),
              productId: product.id,
              quantity: Math.round(item.quantidade),
              unitPrice: Math.round(item.valor * 100), // converter para centavos
              totalPrice: Math.round(item.valor * item.quantidade * 100),
              saleDate: new Date(pedido.data),
            });
            synced++;
          }
        } catch (error) {
          // Pode dar erro de duplicação se já existir, ignorar
          errors++;
        }
      }
    }

    return { synced, errors };
  } catch (error) {
    console.error("Erro ao sincronizar vendas:", error);
    throw error;
  }
}
