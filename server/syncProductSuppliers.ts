/**
 * Sincronização de Fornecedores de Produtos do Bling
 * 
 * Endpoint: GET /produtos/{idProduto}/fornecedores
 * Documentação: https://developer.bling.com.br/produtos#tag/Produtos-Fornecedores/operation/get
 */

import * as db from "./db";

interface BlingSupplierResponse {
  data: Array<{
    id: number;
    fornecedor: {
      id: number;
      nome: string;
    };
    codigo?: string;
    precoCusto?: number;
    precoCompra?: number;
    padrao?: boolean;
    garantia?: number;
  }>;
}

/**
 * Sincroniza fornecedores de um produto específico
 */
async function syncProductSuppliers(
  userId: number,
  productId: number,
  blingRequest: <T>(userId: number, endpoint: string, options?: RequestInit, attempt?: number, syncHistoryId?: number) => Promise<T>
): Promise<number> {
  try {
    const response = await blingRequest<BlingSupplierResponse>(
      userId,
      `/produtos/${productId}/fornecedores`
    );

    if (!response.data || response.data.length === 0) {
      return 0;
    }

    let count = 0;
    for (const supplier of response.data) {
      await db.upsertProductSupplier({
        blingId: `${productId}-${supplier.fornecedor.id}`,
        productId,
        blingProductId: String(productId),
        supplierId: String(supplier.fornecedor.id),
        supplierName: supplier.fornecedor.nome,
        code: supplier.codigo,
        costPrice: supplier.precoCusto ? Math.round(supplier.precoCusto * 100) : 0,
        purchasePrice: supplier.precoCompra ? Math.round(supplier.precoCompra * 100) : 0,
        isDefault: supplier.padrao || false,
        warranty: supplier.garantia || 0,
      });
      count++;
    }

    return count;

  } catch (error: any) {
    // Se produto não tem fornecedores, retornar 0 ao invés de erro
    if (error.message?.includes('404')) {
      return 0;
    }
    throw error;
  }
}

/**
 * Sincroniza fornecedores de todos os produtos
 * Processa em lotes para evitar sobrecarga
 */
export async function syncAllProductSuppliers(
  userId: number,
  blingRequest: <T>(userId: number, endpoint: string, options?: RequestInit, attempt?: number, syncHistoryId?: number) => Promise<T>,
  onProgress?: (current: number, total: number) => void
): Promise<{ totalProducts: number; totalSuppliers: number }> {
  console.log("[Sync Suppliers] Iniciando sincronização de fornecedores...");

  // Buscar todos os produtos do banco
  const products = await db.getAllProducts();
  const totalProducts = products.length;

  console.log(`[Sync Suppliers] ${totalProducts} produtos encontrados`);

  let totalSuppliers = 0;
  let processedProducts = 0;

  // Processar produtos em lotes de 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    for (const product of batch) {
      if (!product.blingId) continue;

      try {
        const suppliersCount = await syncProductSuppliers(
          userId,
          parseInt(product.blingId, 10),
          blingRequest
        );

        totalSuppliers += suppliersCount;
        processedProducts++;

        if (onProgress && processedProducts % 100 === 0) {
          onProgress(processedProducts, totalProducts);
          console.log(`[Sync Suppliers] Progresso: ${processedProducts}/${totalProducts} produtos processados, ${totalSuppliers} fornecedores sincronizados`);
        }

      } catch (error: any) {
        console.error(`[Sync Suppliers] Erro ao sincronizar fornecedores do produto ${product.blingId}:`, error.message);
        // Continuar com próximo produto
      }
    }
  }

  console.log(`[Sync Suppliers] ✅ Sincronização concluída: ${totalSuppliers} fornecedores de ${processedProducts} produtos`);

  return {
    totalProducts: processedProducts,
    totalSuppliers,
  };
}
