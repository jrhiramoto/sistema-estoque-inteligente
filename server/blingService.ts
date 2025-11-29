import * as db from "./db";
import { TRPCError } from "@trpc/server";

// Tipos da API do Bling
interface BlingProduto {
  id: number;
  nome: string;
  codigo?: string;
  preco?: number;
  precoCusto?: number;
  situacao?: string;
  tipo?: string;
  formato?: string;
}

interface BlingEstoque {
  produto: {
    id: number;
  };
  deposito: {
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
    valor: string;
  };
  itens: Array<{
    produto: {
      id: number;
    };
    quantidade: number;
    valor: number;
  }>;
}

interface BlingTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token: string;
}

interface BlingErrorResponse {
  error?: {
    type?: string;
    message?: string;
    description?: string;
  };
}

// Constantes de rate limiting
const REQUEST_DELAY_MS = 350; // 350ms = ~2.8 req/s (limite do Bling: 3 req/s)
const BATCH_SIZE = 100; // Buscar 100 produtos por requisição de estoque
const MAX_RETRIES = 3; // Máximo de tentativas em caso de erro 429
const CIRCUIT_BREAKER_THRESHOLD = 5; // Número de erros 429 consecutivos antes de pausar
const CIRCUIT_BREAKER_PAUSE_MS = 60000; // 1 minuto de pausa após circuit breaker

// Estado do circuit breaker
let consecutiveRateLimitErrors = 0;
let circuitBreakerActive = false;
let circuitBreakerUntil: Date | null = null;

// Helper para aguardar
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcula delay com backoff exponencial
 */
function getBackoffDelay(attempt: number): number {
  return REQUEST_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Verifica se o circuit breaker está ativo
 */
function checkCircuitBreaker(): void {
  if (circuitBreakerActive && circuitBreakerUntil) {
    const now = new Date();
    if (now < circuitBreakerUntil) {
      const remainingMs = circuitBreakerUntil.getTime() - now.getTime();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Circuit breaker ativo. Sistema em pausa por mais ${remainingMin} minuto(s) para evitar bloqueio de IP.`,
      });
    } else {
      // Circuit breaker expirou, resetar
      circuitBreakerActive = false;
      circuitBreakerUntil = null;
      consecutiveRateLimitErrors = 0;
      console.log('[Bling] Circuit breaker desativado. Sistema pronto para novas requisições.');
    }
  }
}

/**
 * Ativa o circuit breaker
 */
function activateCircuitBreaker(): void {
  circuitBreakerActive = true;
  circuitBreakerUntil = new Date(Date.now() + CIRCUIT_BREAKER_PAUSE_MS);
  console.error(`[Bling] ⚠️ CIRCUIT BREAKER ATIVADO! Sistema em pausa por ${CIRCUIT_BREAKER_PAUSE_MS / 60000} minuto(s) para evitar bloqueio de IP.`);
}

/**
 * Reseta contador de erros de rate limit
 */
function resetRateLimitErrors(): void {
  if (consecutiveRateLimitErrors > 0) {
    consecutiveRateLimitErrors = 0;
  }
}

/**
 * Garante que temos um token válido, renovando se necessário
 */
async function ensureValidToken(userId: number): Promise<string> {
  const config = await db.getBlingConfig(userId);
  if (!config) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Configuração do Bling não encontrada",
    });
  }

  // Se não tiver token, precisa autenticar primeiro
  if (!config.accessToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Você precisa autorizar o aplicativo no Bling primeiro",
    });
  }

  // Verificar se o token expirou
  const now = new Date();
  const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt) : new Date(0);

  if (now >= expiresAt) {
    console.log("[Bling] Token expirado, renovando...");

    if (!config.refreshToken) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Refresh token não encontrado. Você precisa autorizar o aplicativo novamente.",
      });
    }

    // Renovar token usando refresh_token
    const response = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Bling] Erro ao renovar token:", errorText);
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Falha ao renovar token. Você precisa autorizar o aplicativo novamente.",
      });
    }

    const tokenData: BlingTokenResponse = await response.json();

    // Atualizar tokens no banco
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

    await db.upsertBlingConfig({
      userId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: newExpiresAt,
    });

    console.log("[Bling] Token renovado com sucesso");
    return tokenData.access_token;
  }

  return config.accessToken;
}

/**
 * Faz uma requisição autenticada para a API do Bling com retry e backoff exponencial
 */
async function blingRequest<T>(
  userId: number,
  endpoint: string,
  options: RequestInit = {},
  attempt: number = 0,
  syncHistoryId?: number
): Promise<T> {
  // Verificar circuit breaker
  checkCircuitBreaker();
  
  const token = await ensureValidToken(userId);
  const url = `https://www.bling.com.br/Api/v3${endpoint}`;
  const startTime = Date.now();

  console.log(`[Bling] Requisição: ${url}${attempt > 0 ? ` (tentativa ${attempt + 1}/${MAX_RETRIES + 1})` : ''}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...options.headers,
    },
  });

  const responseTime = Date.now() - startTime;

  // Log do status
  console.log(`[Bling] Status: ${response.status} ${response.statusText} (${responseTime}ms)`);

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    let isRateLimitError = false;

    // Tentar extrair informações úteis do erro
    if (contentType?.includes("application/json")) {
      try {
        const errorData: BlingErrorResponse = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error.message || errorData.error.description || errorMessage;
        }
      } catch (e) {
        // Se falhar ao parsear JSON, usar mensagem padrão
      }
    } else if (contentType?.includes("text/html")) {
      // API retornou HTML (geralmente página de erro)
      const htmlText = await response.text();
      
      // Tentar extrair informações úteis do HTML
      if (htmlText.includes("404")) {
        errorMessage = "Endpoint não encontrado (404). Verifique se a URL está correta.";
      } else if (htmlText.includes("401") || htmlText.includes("Unauthorized")) {
        errorMessage = "Não autorizado (401). Token pode estar inválido.";
      } else if (htmlText.includes("429") || htmlText.includes("Too Many Requests")) {
        errorMessage = "Limite de requisições atingido (429). Aguarde alguns minutos.";
        isRateLimitError = true;
      } else if (htmlText.includes("500") || htmlText.includes("Internal Server Error")) {
        errorMessage = "Erro interno do servidor Bling (500). Tente novamente mais tarde.";
      } else {
        errorMessage = `Erro ${response.status}: API retornou HTML em vez de JSON`;
      }
      
      console.error(`[Bling] HTML recebido (primeiros 500 chars):`, htmlText.substring(0, 500));
    }

    console.error(`[Bling] Erro detalhado: ${errorMessage}`);

    // Tratamento especial para rate limit (429)
    if (response.status === 429 || isRateLimitError) {
      consecutiveRateLimitErrors++;
      console.warn(`[Bling] ⚠️ Rate limit atingido (erro ${consecutiveRateLimitErrors}/${CIRCUIT_BREAKER_THRESHOLD})`);
      
      // Registrar erro de rate limit
      await db.logApiUsage({
        userId,
        endpoint,
        method: options.method || 'GET',
        statusCode: response.status,
        responseTime,
        isRateLimitError: true,
        retryAttempt: attempt,
        circuitBreakerActive,
        syncHistoryId,
      });
      
      // Verificar se deve ativar circuit breaker
      if (consecutiveRateLimitErrors >= CIRCUIT_BREAKER_THRESHOLD) {
        activateCircuitBreaker();
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Circuit breaker ativado após ${CIRCUIT_BREAKER_THRESHOLD} erros 429 consecutivos. Sistema em pausa por ${CIRCUIT_BREAKER_PAUSE_MS / 60000} minuto(s).`,
        });
      }
      
      // Tentar retry com backoff exponencial
      if (attempt < MAX_RETRIES) {
        const backoffDelay = getBackoffDelay(attempt);
        console.log(`[Bling] Aguardando ${backoffDelay}ms antes de tentar novamente...`);
        await delay(backoffDelay);
        return blingRequest<T>(userId, endpoint, options, attempt + 1, syncHistoryId);
      }
      
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Limite de requisições atingido após múltiplas tentativas. Aguarde alguns minutos e tente novamente.",
      });
    }

    throw new Error(errorMessage);
  }

  // Requisição bem-sucedida, resetar contador de erros
  resetRateLimitErrors();

  // Registrar métrica de sucesso
  await db.logApiUsage({
    userId,
    endpoint,
    method: options.method || 'GET',
    statusCode: response.status,
    responseTime,
    isRateLimitError: false,
    retryAttempt: attempt,
    circuitBreakerActive,
    syncHistoryId,
  });

  return await response.json();
}

/**
 * Sincroniza produtos do Bling
 */
export async function syncProducts(
  userId: number,
  incremental: boolean = false,
  onProgress?: (current: number, total: number | null, message: string) => void
): Promise<{ synced: number; errors: number }> {
  try {
    let synced = 0;
    let errors = 0;
    let page = 1;
    const limit = 100; // Máximo permitido pela API
    let hasMore = true;
    let consecutiveEmptyPages = 0;
    const MAX_EMPTY_PAGES = 3; // Se encontrar 3 páginas vazias seguidas, para

    // Buscar última sincronização para modo incremental
    let dataAlteracaoInicial: string | undefined;
    
    if (incremental) {
      const lastSync = await db.getLastSuccessfulSync(userId, 'products');
      if (lastSync && lastSync.completedAt) {
        dataAlteracaoInicial = lastSync.completedAt.toISOString().split('T')[0];
        console.log(`[Bling] Modo incremental ativado - buscando produtos alterados desde ${dataAlteracaoInicial}`);
      } else {
        console.log('[Bling] Primeira sincronização - buscando todos os produtos');
      }
    } else {
      console.log('[Bling] Sincronização completa - buscando todos os produtos');
    }

    while (hasMore) {
      try {
        console.log(`[Bling] Buscando produtos - página ${page} (${synced} sincronizados até agora)`);
        
        // Atualizar progresso
        if (onProgress) {
          onProgress(synced, null, `Sincronizando produtos - Página ${page}`);
        }

        // Construir URL com parâmetros opcionais
        let url = `/produtos?pagina=${page}&limite=${limit}`;
        if (dataAlteracaoInicial) {
          url += `&dataAlteracaoInicial=${dataAlteracaoInicial}`;
        }

        const response = await blingRequest<{ data: BlingProduto[] }>(userId, url);
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
          
          page++;
          await delay(REQUEST_DELAY_MS);
          continue;
        }

        consecutiveEmptyPages = 0; // Reset contador se encontrou produtos

        for (const produto of produtos) {
          try {
            await db.upsertProduct({
              blingId: String(produto.id),
              name: produto.nome,
              code: produto.codigo || undefined,
              price: produto.preco ? Math.round(produto.preco * 100) : undefined, // converter para centavos
              cost: produto.precoCusto ? Math.round(produto.precoCusto * 100) : undefined, // converter para centavos
            });
            synced++;

            // Atualizar progresso a cada 1000 produtos
            if (synced % 1000 === 0 && onProgress) {
              onProgress(synced, null, `Sincronizando produtos - ${synced} produtos`);
            }
          } catch (error) {
            console.error(`Erro ao inserir produto ${produto.id}:`, error);
            errors++;
          }
        }

        page++;
        
        // Aguardar antes da próxima página (rate limiting)
        await delay(REQUEST_DELAY_MS);
        
      } catch (error: any) {
        console.error(`Erro ao buscar página ${page}:`, error.message);
        
        // Se for erro 429, parar a sincronização
        if (error.message.includes('429')) {
          console.log('[Bling] Rate limit atingido. Parando sincronização.');
          throw error;
        }
        
        errors++;
        break;
      }
    }

    console.log(`[Bling] Sincronização de produtos concluída: ${synced} produtos, ${errors} erros`);
    return { synced, errors };
  } catch (error) {
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
    // Buscar todos os produtos locais
    const products = await db.getAllProducts();
    console.log(`[Bling] Sincronizando estoque de ${products.length} produtos...`);

    if (onProgress) {
      onProgress(0, products.length, `Sincronizando estoque - 0/${products.length}`);
    }

    let synced = 0;
    let errors = 0;

    // Processar em lotes para reduzir número de requisições
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(products.length / BATCH_SIZE);

      console.log(`[Bling] Processando lote ${batchNumber}/${totalBatches} (${batch.length} produtos)`);

      try {
        // Construir parâmetros para buscar estoque de múltiplos produtos
        const idsParam = batch.map(p => `idsProdutos[]=${p.blingId}`).join('&');
        
        const response = await blingRequest<{ data: BlingEstoque[] }>(
          userId,
          `/estoques/saldos?${idsParam}`
        );

        const estoques = response.data || [];
        console.log(`[Bling] Lote ${batchNumber}: ${estoques.length} registros de estoque retornados`);

        // Processar cada estoque retornado
        for (const estoque of estoques) {
          try {
            const product = batch.find(p => p.blingId === String(estoque.produto.id));
            if (product) {
              await db.upsertInventory({
                productId: product.id,
                depositId: String(estoque.deposito.id),
                depositName: estoque.deposito.nome,
                virtualStock: Math.round(estoque.saldoVirtualTotal),
                physicalStock: Math.round(estoque.saldoFisicoTotal),
              });
              synced++;
            }
          } catch (error) {
            console.error(`Erro ao inserir estoque do produto ${estoque.produto.id}:`, error);
            errors++;
          }
        }

        // Atualizar progresso
        if (onProgress) {
          onProgress(synced, products.length, `Sincronizando estoque - ${synced}/${products.length}`);
        }

        // Aguardar antes do próximo lote (rate limiting)
        if (i + BATCH_SIZE < products.length) {
          await delay(REQUEST_DELAY_MS);
        }
      } catch (error: any) {
        console.error(`Erro ao buscar estoque do lote ${batchNumber}:`, error.message);
        
        // Se for erro 429, parar a sincronização
        if (error.message.includes('429')) {
          console.log('[Bling] Rate limit atingido. Parando sincronização de estoque.');
          throw error;
        }
        
        errors += batch.length;
      }
    }

    console.log(`[Bling] Sincronização de estoque concluída: ${synced} registros, ${errors} erros`);
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
    
    let synced = 0;
    let errors = 0;
    let page = 1;
    const limit = 100; // Buscar 100 pedidos por página (máximo da API)
    let hasMore = true;
    let consecutiveEmptyPages = 0;
    const MAX_EMPTY_PAGES = 3;
    
    console.log(`[Bling] Iniciando sincronização de vendas...`);

    while (hasMore) {
      try {
        console.log(`[Bling] Buscando vendas - página ${page} (${synced} itens sincronizados até agora)`);
        
        if (onProgress) {
          onProgress(synced, null, `Sincronizando vendas - Página ${page}`);
        }
        
        const response = await blingRequest<{ data: BlingPedido[] }>(
          userId,
          `/pedidos/vendas?pagina=${page}&limite=${limit}&dataInicial=${dataInicial.toISOString().split('T')[0]}&dataFinal=${dataFinal.toISOString().split('T')[0]}&${idsSituacoesParam}`
        );
        
        const pedidos = response.data || [];
        
        console.log(`[Bling] Página ${page}: ${pedidos.length} pedidos retornados`);
        
        if (pedidos.length === 0) {
          consecutiveEmptyPages++;
          console.log(`[Bling] Página vazia (${consecutiveEmptyPages}/${MAX_EMPTY_PAGES})`);
          
          if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
            console.log('[Bling] Múltiplas páginas vazias consecutivas. Finalizando sincronização.');
            hasMore = false;
            break;
          }
          
          page++;
          await delay(REQUEST_DELAY_MS);
          continue;
        }
        
        consecutiveEmptyPages = 0;

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
                  onProgress(synced, null, `Sincronizando vendas - ${synced} itens`);
                }
              }
            } catch (error) {
              // Pode dar erro de duplicação se já existir, ignorar
              errors++;
            }
          }
        }
        
        // Continuar para próxima página
        page++;
        
        // Aguardar antes da próxima página (rate limiting)
        await delay(REQUEST_DELAY_MS);
        
      } catch (error: any) {
        console.error(`Erro ao buscar página ${page} de vendas:`, error.message);
        
        // Se for erro 429, parar a sincronização
        if (error.message.includes('429')) {
          console.log('[Bling] Rate limit atingido. Parando sincronização de vendas.');
          throw error;
        }
        
        errors++;
        break;
      }
    }
    
    console.log(`[Bling] Sincronização de vendas concluída: ${synced} itens, ${errors} erros`);
    return { synced, errors };
  } catch (error) {
    console.error("Erro ao sincronizar vendas:", error);
    throw error;
  }
}

/**
 * Troca o authorization code por access token
 */
export async function exchangeCodeForToken(
  userId: number,
  code: string
): Promise<void> {
  const config = await db.getBlingConfig(userId);
  if (!config || !config.clientId || !config.clientSecret) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Credenciais do Bling não configuradas",
    });
  }

  const response = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Bling] Erro ao trocar código:", errorText);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Código de autorização inválido ou expirado",
    });
  }

  const tokenData: BlingTokenResponse = await response.json();

  // Calcular data de expiração
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  // Salvar tokens no banco
  await db.upsertBlingConfig({
    userId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    tokenExpiresAt: expiresAt,
  });
}
