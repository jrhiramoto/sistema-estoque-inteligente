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
    codigo?: string;
  };
  saldoVirtualTotal: number;
  saldoFisicoTotal: number;
  depositos: Array<{
    id: number;
    saldoFisico: number;
    saldoVirtual: number;
  }>;
}

interface BlingPedido {
  id: number;
  numero: string;
  data: string;
  total?: number; // Valor total do pedido fornecido pela API
  situacao: {
    id: number;
    valor: string | number;
  };
  contato?: {
    id: number;
    nome: string;
    tipoPessoa: string;
    numeroDocumento: string;
  };
  itens?: Array<{
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

// Cache de situações de pedidos (atualizado quando necessário)
let situacoesCache: Map<number, { id: number; nome: string; cor: string }> = new Map();
let situacoesCacheExpiry: Date | null = null;
const SITUACOES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Mapeamento manual de situações comuns (fallback quando API falhar)
const SITUACOES_MANUAIS: Record<number, string> = {
  9: 'Atendido',
  12: 'Cancelado',
  6: 'Em aberto',
  15: 'Atendido',
  24: 'Faturado',
  // Adicionar mais conforme necessário
};

/**
 * Valida se um código de produto deve ser considerado no sistema
 * Exclui:
 * - Códigos entre 50000 e 51000 (inclusive)
 * - Códigos abaixo de 2000
 */
export function isValidProductCode(code: string | null | undefined): boolean {
  if (!code) return false;
  
  const numericCode = parseInt(code, 10);
  if (isNaN(numericCode)) return true; // Códigos não numéricos são aceitos
  
  // Excluir códigos abaixo de 2000
  if (numericCode < 2000) return false;
  
  // Excluir códigos entre 50000 e 51000 (inclusive)
  if (numericCode >= 50000 && numericCode <= 51000) return false;
  
  return true;
}

/**
 * Busca o nome da situação pelo ID, usando mapeamento manual como fallback
 */
function getSituacaoNome(situacaoId: number): string {
  // Primeiro, tentar buscar no cache
  if (situacoesCache.size > 0) {
    const situacao = situacoesCache.get(situacaoId);
    if (situacao) return situacao.nome;
  }
  
  // Se não encontrar no cache, usar mapeamento manual
  return SITUACOES_MANUAIS[situacaoId] || `Situação ${situacaoId}`;
}

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
      message: "Configuração do Bling não encontrada. Por favor, configure suas credenciais primeiro (Passo 1).",
    });
  }

  // Se não tiver token, precisa autenticar primeiro
  if (!config.accessToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Você precisa autorizar o aplicativo no Bling primeiro",
    });
  }

  // Verificar se o token expirou ou expira em menos de 1 hora
  const now = new Date();
  const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt) : new Date(0);
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  
  const needsRenewal = oneHourFromNow >= expiresAt;
  
  if (needsRenewal) {
    const hoursRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    console.log(`[Bling] Token expira em ${hoursRemaining}h, renovando preventivamente...`);

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
      
      // Limpar tokens inválidos do banco
      await db.upsertBlingConfig({
        userId,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        isActive: false,
      });
      
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Seu token do Bling expirou. Por favor, vá em Configurações e autorize o aplicativo novamente (Passo 2).",
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
export async function blingRequest<T>(
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

  // Validar Content-Type antes de parsear JSON
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await response.text();
    console.error(`[Bling] Resposta não-JSON recebida (Content-Type: ${contentType}):`, text.substring(0, 500));
    throw new Error(`API retornou ${contentType || 'conteúdo desconhecido'} em vez de JSON. Verifique se o endpoint está correto.`);
  }

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
              // A API retorna saldos totais e array de depósitos
              // Vamos salvar um registro por depósito
              if (estoque.depositos && estoque.depositos.length > 0) {
                for (const deposito of estoque.depositos) {
                  await db.upsertInventory({
                    productId: product.id,
                    depositId: String(deposito.id),
                    depositName: 'Depósito Principal', // API não retorna nome do depósito
                    virtualStock: Math.round(deposito.saldoVirtual),
                    physicalStock: Math.round(deposito.saldoFisico),
                  });
                }
              } else {
                // Se não houver depósitos, salvar apenas os totais
                await db.upsertInventory({
                  productId: product.id,
                  depositId: '0',
                  depositName: 'Depósito Principal',
                  virtualStock: Math.round(estoque.saldoVirtualTotal),
                  physicalStock: Math.round(estoque.saldoFisicoTotal),
                });
              }
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
 * Sincroniza vendas do Bling (últimos 12 meses)
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
        // Se não houver sincronização anterior, buscar últimos 12 meses
        dataInicial = new Date();
        dataInicial.setDate(dataInicial.getDate() - 365);
        console.log('[Bling] Primeira sincronização de vendas - buscando últimos 12 meses');
      }
    } else {
      // Modo completo: buscar últimos 12 meses
      dataInicial = new Date();
      dataInicial.setDate(dataInicial.getDate() - 365);
      console.log('[Bling] Sincronização completa de vendas - últimos 12 meses');
    }
    
    const dataFinal = new Date();

    // TEMPORÁRIO: Removendo filtro de situações para buscar TODOS os pedidos
    // Depois de validar, adicionar filtro conforme necessário
    // const situacoesValidas = [15, 24]; // atendido e faturado
    // const idsSituacoesParam = situacoesValidas.map(id => `idsSituacoes[]=${id}`).join('&');
    
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
        
        const url = `/pedidos/vendas?pagina=${page}&limite=${limit}&dataInicial=${dataInicial.toISOString().split('T')[0]}&dataFinal=${dataFinal.toISOString().split('T')[0]}`;
        console.log(`[Bling] URL da requisição: ${url}`);
        
        const response = await blingRequest<{ data: BlingPedido[] }>(
          userId,
          url
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
          try {
            // Log da situação para debug
            console.log(`[Bling] Pedido ${pedido.numero} - Situação ID: ${pedido.situacao.id}, Valor: ${pedido.situacao.valor}`);
            
            // Buscar detalhes do pedido para obter itens (API de listagem não retorna itens)
            let pedidoDetalhado = pedido;
            if (!pedido.itens || pedido.itens.length === 0) {
              try {
                const detalhesResponse = await blingRequest<{ data: BlingPedido }>(
                  userId,
                  `/pedidos/vendas/${pedido.id}`
                );
                pedidoDetalhado = detalhesResponse.data;
                console.log(`[Bling] Pedido ${pedido.numero} - Detalhes obtidos, ${pedidoDetalhado.itens?.length || 0} itens`);
              } catch (error) {
                console.error(`[Bling] Erro ao buscar detalhes do pedido ${pedido.numero}:`, error);
                // Continuar com pedido sem itens
              }
            }
            
            // TEMPORÁRIO: Removendo validação de situações para buscar TODOS os pedidos
            // if (!situacoesValidas.includes(pedido.situacao.id)) {
            //   console.log(`[Bling] Pedido ${pedido.numero} ignorado - situação não válida`);
            //   continue;
            // }
            
            // Calcular total do pedido
            // Usar campo 'total' da API se disponível, senão calcular dos itens
            let totalAmount = 0;
            
            if (pedidoDetalhado.total !== undefined && pedidoDetalhado.total !== null) {
              // Usar total fornecido pela API
              totalAmount = pedidoDetalhado.total;
              console.log(`[Bling] Pedido ${pedido.numero} - Total da API: ${totalAmount}`);
            } else if (pedidoDetalhado.itens && Array.isArray(pedidoDetalhado.itens) && pedidoDetalhado.itens.length > 0) {
              // Calcular dos itens
              totalAmount = pedidoDetalhado.itens.reduce((sum, item) => {
                return sum + (item.valor * item.quantidade);
              }, 0);
              console.log(`[Bling] Pedido ${pedido.numero} - Total calculado dos itens: ${totalAmount}`);
            } else {
              console.warn(`[Bling] Pedido ${pedido.numero} - SEM TOTAL E SEM ITENS! Usando 0.`);
            }
            
            const itemsCount = pedidoDetalhado.itens && Array.isArray(pedidoDetalhado.itens) ? pedidoDetalhado.itens.length : 0;
            
            // Buscar nome correto da situação usando o ID
            const statusId = pedido.situacao?.id || 0;
            const statusNome = statusId > 0 ? getSituacaoNome(statusId) : 'Desconhecido';
            
            console.log(`[Bling] Pedido ${pedido.numero} - Situação: ID=${statusId}, Nome=${statusNome}`);
            
            // Salvar pedido completo na tabela orders
            try {
              await db.upsertOrder({
              blingId: String(pedido.id),
              orderNumber: pedido.numero,
              orderDate: new Date(pedido.data),
              customerName: pedido.contato?.nome || null,
              customerDocument: pedido.contato?.numeroDocumento || null,
              status: statusNome,
              statusId: statusId,
              totalAmount: Math.round(totalAmount * 100), // converter para centavos
              itemsCount: itemsCount,
              });
            } catch (error) {
              console.error(`[Bling] Erro ao salvar pedido ${pedido.numero}:`, error);
              console.error(`[Bling] Dados do pedido:`, JSON.stringify(pedido, null, 2));
              errors++;
              continue;
            }
            
            // Salvar itens individuais na tabela sales para análise ABC
            if (pedidoDetalhado.itens && Array.isArray(pedidoDetalhado.itens)) {
              for (const item of pedidoDetalhado.itens) {
                try {
                  // Buscar produto pelo código do Bling
                  const produto = await db.getProductByBlingId(String(item.produto?.id || 0));
                  
                  if (produto) {
                    await db.upsertSale({
                      blingOrderId: String(pedido.id),
                      productId: produto.id,
                      quantity: item.quantidade,
                      unitPrice: Math.round(item.valor * 100), // converter para centavos
                      totalPrice: Math.round(item.valor * item.quantidade * 100), // converter para centavos
                      orderStatus: statusNome,
                      saleDate: new Date(pedido.data),
                    });
                  } else {
                    console.warn(`[Bling] Produto ${item.produto?.id} do pedido ${pedido.numero} não encontrado no banco`);
                  }
                } catch (error) {
                  console.error(`[Bling] Erro ao salvar item do pedido ${pedido.numero}:`, error);
                  // Não incrementar errors pois o pedido foi salvo com sucesso
                }
              }
            }
            
            synced++;
            
            // Atualizar progresso a cada pedido
            if (onProgress) {
              onProgress(synced, null, `Sincronizando vendas - ${synced} pedidos`);
            }
            
          } catch (error: any) {
            console.error(`[Bling] Erro ao processar pedido ${pedido.numero}:`, error.message);
            errors++;
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
    isActive: true, // Marcar como ativo após autorização bem-sucedida
  });
}

/**
 * Lista todas as situações de pedidos disponíveis no Bling
 */
/**
 * Atualiza os nomes das situações de todos os pedidos usando mapeamento manual
 */
export async function updateOrderStatusNames(userId: number): Promise<{ updated: number; errors: number }> {
  console.log('[Bling] Atualizando nomes das situações dos pedidos...');
  
  const db = await import('./db');
  
  // Buscar todos os pedidos com suas situações
  const dbConn = await db.getDb();
  if (!dbConn) {
    throw new Error('Database não disponível');
  }
  
  const [pedidos] = await (await import('mysql2/promise')).createConnection(process.env.DATABASE_URL!)
    .then(conn => conn.execute('SELECT id, statusId FROM orders'));
  
  let updated = 0;
  let errors = 0;
  
  for (const pedido of pedidos as any[]) {
    try {
      const statusNome = getSituacaoNome(pedido.statusId);
      
      await (await import('mysql2/promise')).createConnection(process.env.DATABASE_URL!)
        .then(conn => conn.execute(
          'UPDATE orders SET status = ? WHERE id = ?',
          [statusNome, pedido.id]
        ));
      
      updated++;
    } catch (error) {
      console.error(`[Bling] Erro ao atualizar pedido ${pedido.id}:`, error);
      errors++;
    }
  }
  
  console.log(`[Bling] Atualização concluída: ${updated} pedidos atualizados, ${errors} erros`);
  
  return { updated, errors };
}

export async function listOrderSituations(userId: number): Promise<Array<{ id: number; nome: string; cor: string }>> {
  console.log('[Bling] Listando situações de pedidos...');
  
  try {
    const response = await blingRequest<{
      data: Array<{
        id: number;
        nome: string;
        cor: string;
      }>;
    }>(userId, '/situacoes/modulos/Vendas');
    
    console.log(`[Bling] ✓ ${response.data.length} situações encontradas`);
    
    return response.data;
  } catch (error: any) {
    console.error('[listOrderSituations] Erro:', error);
    
    // Se o erro for de autenticação, lançar mensagem mais clara
    if (error.message?.includes('Não encontrado') || error.message?.includes('Unauthorized')) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Você precisa autorizar o aplicativo no Passo 2 antes de listar situações de pedidos.',
      });
    }
    
    throw error;
  }
}


/**
 * Função de teste para buscar pedidos de venda do Bling
 * Retorna dados brutos para validação antes de implementar sincronização completa
 */
export async function testFetchOrders(
  userId: number,
  options: {
    dataInicial?: string;
    dataFinal?: string;
    limite?: number;
  } = {}
) {
  const {
    dataInicial = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias atrás
    dataFinal = new Date().toISOString().split('T')[0], // hoje
    limite = 5, // buscar apenas 5 pedidos para teste
  } = options;

  console.log(`[Bling Test] Buscando pedidos de venda - Data: ${dataInicial} a ${dataFinal}, Limite: ${limite}`);

  try {
    // Buscar pedidos sem filtro de situação para ver o que retorna
    const response = await blingRequest<{ data: any[] }>(
      userId,
      `/pedidos/vendas?pagina=1&limite=${limite}&dataInicial=${dataInicial}&dataFinal=${dataFinal}`
    );

    const pedidos = response.data || [];
    
    console.log(`[Bling Test] ${pedidos.length} pedidos retornados`);
    
    // Log detalhado de cada pedido para análise
    pedidos.forEach((pedido, index) => {
      console.log(`[Bling Test] Pedido ${index + 1}:`, JSON.stringify(pedido, null, 2));
    });

    return {
      success: true,
      count: pedidos.length,
      pedidos: pedidos.map((p: any) => ({
        id: p.id,
        numero: p.numero,
        numeroLoja: p.numeroLoja,
        data: p.data,
        dataSaida: p.dataSaida,
        dataPrevista: p.dataPrevista,
        totalProdutos: p.totalProdutos,
        total: p.total,
        contato: p.contato ? {
          id: p.contato.id,
          nome: p.contato.nome,
          tipoPessoa: p.contato.tipoPessoa,
          numeroDocumento: p.contato.numeroDocumento,
        } : null,
        situacao: p.situacao ? {
          id: p.situacao.id,
          valor: p.situacao.valor,
        } : null,
        loja: p.loja ? {
          id: p.loja.id,
          nome: p.loja.nome,
        } : null,
        itens: p.itens ? p.itens.map((item: any) => ({
          produto: {
            id: item.produto?.id,
            nome: item.produto?.nome,
            codigo: item.produto?.codigo,
          },
          quantidade: item.quantidade,
          valor: item.valor,
          desconto: item.desconto,
        })) : [],
      })),
    };
  } catch (error: any) {
    console.error('[Bling Test] Erro ao buscar pedidos:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Erro ao buscar pedidos de teste: ${error.message}`,
    });
  }
}
