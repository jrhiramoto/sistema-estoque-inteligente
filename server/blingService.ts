import axios from "axios";
import * as db from "./db";
const BLING_API_URL = "https://api.bling.com.br/Api/v3";
const BLING_OAUTH_URL = "https://www.bling.com.br/Api/v3/oauth/token";

// Rate limiting: delay entre requisições (em ms)
const REQUEST_DELAY_MS = 2000; // 2000ms = 1 requisição a cada 2 segundos (muito conservador para evitar conflitos)

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
  situacao: {
    id: number;
    valor: number;
  };
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

    // Verificar se a resposta é HTML ao invés de JSON
    if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
      console.error('[Bling API] ❌ Resposta HTML recebida ao invés de JSON');
      console.error('[Bling API] Endpoint:', `${BLING_API_URL}${endpoint}`);
      console.error('[Bling API] Status:', response.status);
      console.error('[Bling API] Primeiros 500 caracteres:', response.data.substring(0, 500));
      
      // Tentar extrair informação útil do HTML
      let errorHint = '';
      if (response.data.includes('404') || response.data.includes('Not Found')) {
        errorHint = 'Endpoint não encontrado. Verifique se a URL está correta.';
      } else if (response.data.includes('401') || response.data.includes('Unauthorized')) {
        errorHint = 'Token de acesso inválido ou expirado. Tente reautorizar na página de Configurações.';
      } else if (response.data.includes('429') || response.data.includes('Too Many Requests')) {
        errorHint = 'Limite de requisições atingido. Aguarde alguns minutos antes de tentar novamente.';
      } else if (response.data.includes('500') || response.data.includes('Internal Server Error')) {
        errorHint = 'Erro no servidor do Bling. Tente novamente em alguns minutos.';
      } else {
        errorHint = 'Erro desconhecido no servidor do Bling.';
      }
      
      throw new Error(`${errorHint} (Resposta HTML recebida ao invés de JSON)`);
    }
    
    console.log(`[Bling API] Sucesso: ${method} ${endpoint}`);
    return response.data;
  } catch (error: any) {
    // Se já é um erro tratado (HTML), relançar
    if (error.message && !error.response) {
      throw error;
    }
    
    const status = error.response?.status;
    const errorData = error.response?.data;
    const errorMessage = errorData?.error?.message || errorData?.message || error.message;
    
    console.error(`[Bling API] ❌ Erro ${status} em ${endpoint}:`, {
      status,
      message: errorMessage,
      data: errorData,
      url: `${BLING_API_URL}${endpoint}`,
    });
    
    // Mensagens amigáveis por tipo de erro
    let friendlyMessage = '';
    
    switch (status) {
      case 400:
        friendlyMessage = 'Requisição inválida. Verifique os parâmetros enviados.';
        break;
      case 401:
        friendlyMessage = 'Token de acesso inválido ou expirado. Reautorize o sistema na página de Configurações.';
        break;
      case 403:
        friendlyMessage = 'Acesso negado. Verifique as permissões do aplicativo no Bling.';
        break;
      case 404:
        friendlyMessage = 'Recurso não encontrado. O endpoint pode estar incorreto.';
        break;
      case 429:
        friendlyMessage = 'Limite de requisições atingido. O sistema irá tentar novamente automaticamente em alguns minutos.';
        break;
      case 500:
      case 502:
      case 503:
        friendlyMessage = 'Erro no servidor do Bling. Tente novamente em alguns minutos.';
        break;
      default:
        friendlyMessage = `Erro ao acessar API do Bling: ${errorMessage}`;
    }
    
    throw new Error(friendlyMessage);
  }
}

/**
 * Sincroniza produtos do Bling
 */
export async function syncProducts(
  userId: number,
  onProgress?: (current: number, total: number | null, message: string) => void,
  incremental: boolean = false
): Promise<{ synced: number; errors: number }> {
  try{
    let synced = 0;
    let errors = 0;
    let page = 1;
    const limit = 100; // Buscar 100 produtos por página
    let hasMore = true;
    let consecutiveEmptyPages = 0;
    const MAX_EMPTY_PAGES = 3; // Parar após 3 páginas vazias consecutivas

    // Buscar última sincronização para modo incremental
    let lastSyncDate: Date | null = null;
    if (incremental) {
      const lastSync = await db.getLastSuccessfulSync(userId, 'products');
      if (lastSync && lastSync.completedAt) {
        lastSyncDate = lastSync.completedAt;
        console.log(`[Bling] Modo incremental ativado - buscando produtos alterados desde ${lastSyncDate.toISOString()}`);
      } else {
        console.log('[Bling] Primeira sincronização - modo incremental desativado');
      }
    }

    console.log(`[Bling] Iniciando sincronização ${incremental && lastSyncDate ? 'incremental' : 'completa'} de produtos...`);

    while (hasMore) {
      try {
        console.log(`[Bling] Buscando produtos - página ${page} (${synced} sincronizados até agora)`);
        
        // Atualizar progresso
        if (onProgress) {
          onProgress(synced, null, `Sincronizando produtos - Página ${page}`);
        }
        
        // Construir URL com filtro de data se incremental
        let url = `/produtos?pagina=${page}&limite=${limit}`;
        if (incremental && lastSyncDate) {
          const dataAlteracao = lastSyncDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
          url += `&dataAlteracaoInicial=${dataAlteracao}`;
        }
        
        const response = await blingRequest<{ data: BlingProduct[] }>(
          userId,
          url
        );
        const produtos = response.data || [];

        console.log(`[Bling] Página ${page}: ${produtos.length} produtos retornados`);

        if (produtos.length === 0) {
          consecutiveEmptyPages++;
          console.log(`[Bling] Página vazia (${consecutiveEmptyPages}/${MAX_EMPTY_PAGES})`);
          
          if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
            console.log('[Bling] Múltiplas páginas vazias consecutivas. Finalizando sincronização.');
            hasMore = false;
            break;
          }
          
          // Continuar para próxima página mesmo se vazia
          page++;
          await delay(REQUEST_DELAY_MS);
          continue;
        }

        // Reset contador de páginas vazias
        consecutiveEmptyPages = 0;

        for (const produto of produtos) {
          try {
            await db.upsertProduct({
              blingId: String(produto.id),
              name: produto.nome,
              code: produto.codigo || null,
              price: produto.preco ? Math.round(parseFloat(String(produto.preco)) * 100) : 0,
              cost: produto.precoCusto ? Math.round(parseFloat(String(produto.precoCusto)) * 100) : 0,
              unit: produto.unidade || null,
             });
            synced++;
          } catch (error) {
            console.error(`Erro ao sincronizar produto ${produto.id}:`, error);
            errors++;
          }
        }

        // A cada 1000 produtos, mostrar progresso
        if (synced % 1000 === 0 && synced > 0) {
          console.log(`[Bling] 📊 Progresso: ${synced} produtos sincronizados...`);
          if (onProgress) {
            onProgress(synced, null, `${synced} produtos sincronizados`);
          }
        }
        
        // Continuar para próxima página
        page++;
        
        // Aguardar antes da próxima página (rate limiting)
        await delay(REQUEST_DELAY_MS);
        
      } catch (error: any) {
        console.error(`Erro ao buscar página ${page} de produtos:`, error.message);
        
        // Se for erro 429, parar a sincronização
        if (error.message.includes('429')) {
          console.error('[Bling] Rate limit atingido. Parando sincronização.');
          throw error;
        }
        
        // Para outros erros, tentar continuar
        console.log('[Bling] Tentando continuar após erro...');
        page++;
        await delay(REQUEST_DELAY_MS * 2); // Delay maior após erro
      }
    }

    console.log(`[Bling] Sincronização completa! Total: ${synced} produtos sincronizados, ${errors} erros`);
    return { synced, errors };
  } catch (error: any) {
    console.error("Erro ao sincronizar produtos:", error);
    throw error;
  }
}

/**
 * Sincroniza estoque do Bling
 */
export async function syncInventory(
  userId: number,
  onProgress?: (current: number, total: number | null, message: string) => void
): Promise<{ synced: number; errors: number }> {
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
    
    console.log(`[Bling] Sincronizando estoque de ${products.length} produtos...`);
    
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      // Atualizar progresso
      if (onProgress) {
        onProgress(synced, products.length, `Sincronizando estoque - ${synced}/${products.length}`);
      }
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
              
              // Atualizar progresso a cada 100 itens
              if (synced % 100 === 0 && onProgress) {
                onProgress(synced, products.length, `Sincronizando estoque - ${synced}/${products.length}`);
              }
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
export async function syncSales(
  userId: number,
  incremental: boolean = false,
  onProgress?: (current: number, total: number | null, message: string) => void
): Promise<{ synced: number; errors: number }> {
  try {
    // Buscar última sincronização para modo incremental
    let dataInicial: Date;
    
    if (incremental) {
      const lastSync = await db.getLastSuccessfulSync(userId, 'sales');
      if (lastSync && lastSync.completedAt) {
        dataInicial = lastSync.completedAt;
        console.log(`[Bling] Modo incremental ativado para vendas - buscando desde ${dataInicial.toISOString()}`);
      } else {
        // Se não houver sincronização anterior, buscar últimos 30 dias
        dataInicial = new Date();
        dataInicial.setDate(dataInicial.getDate() - 30);
        console.log('[Bling] Primeira sincronização de vendas - buscando últimos 30 dias');
      }
    } else {
      // Modo completo: buscar últimos 30 dias
      dataInicial = new Date();
      dataInicial.setDate(dataInicial.getDate() - 30);
      console.log('[Bling] Sincronização completa de vendas - últimos 30 dias');
    }
    
    const dataFinal = new Date();

    // Filtrar apenas pedidos com situação "atendido" (id: 15) e "faturado" (id: 24)
    // Nota: Esses IDs podem variar por conta. Ajuste conforme necessário.
    const situacoesValidas = [15, 24]; // atendido e faturado
    const idsSituacoesParam = situacoesValidas.map(id => `idsSituacoes[]=${id}`).join('&');
    
    const response = await blingRequest<{ data: BlingPedido[] }>(
      userId,
      `/pedidos/vendas?dataInicial=${dataInicial.toISOString().split('T')[0]}&dataFinal=${dataFinal.toISOString().split('T')[0]}&${idsSituacoesParam}`
    );
    
    const pedidos = response.data || [];

    let synced = 0;
    let errors = 0;
    
    console.log(`[Bling] Sincronizando ${pedidos.length} pedidos de venda...`);
    if (onProgress) {
      onProgress(0, pedidos.length, `Sincronizando vendas - 0/${pedidos.length}`);
    }

    for (const pedido of pedidos) {
      // Log da situação para debug
      console.log(`[Bling] Pedido ${pedido.numero} - Situação ID: ${pedido.situacao.id}, Valor: ${pedido.situacao.valor}`);
      
      // Validar situação (redundante, mas garante segurança)
      if (!situacoesValidas.includes(pedido.situacao.id)) {
        console.log(`[Bling] Pedido ${pedido.numero} ignorado - situação não válida`);
        continue;
      }
      
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
            
            // Atualizar progresso a cada 10 vendas
            if (synced % 10 === 0 && onProgress) {
              onProgress(synced, pedidos.length, `Sincronizando vendas - ${synced}/${pedidos.length}`);
            }
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
