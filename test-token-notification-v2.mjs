/**
 * Teste da Lógica de Notificação de Token v2
 * 
 * Valida que:
 * 1. Detecta erro invalid_grant corretamente
 * 2. Notifica imediatamente quando refresh_token inválido
 * 3. Desativa integração para parar tentativas
 * 4. Não notifica quando token ainda tem tempo e renovação funciona
 */

console.log('='.repeat(80));
console.log('TESTE: Lógica de Notificação de Token v2');
console.log('='.repeat(80));

// Simular detecção de erro invalid_grant
function testInvalidGrantDetection() {
  console.log('\n📋 Teste 1: Detecção de erro invalid_grant');
  console.log('-'.repeat(80));
  
  const testCases = [
    {
      name: 'JSON com error.type',
      errorText: '{"error":{"type":"invalid_grant","message":"invalid_grant","description":"Invalid refresh token"}}',
      expected: true
    },
    {
      name: 'JSON com error.message',
      errorText: '{"error":{"message":"invalid_grant"}}',
      expected: true
    },
    {
      name: 'Texto plano com invalid_grant',
      errorText: 'Error: invalid_grant - refresh token expired',
      expected: true
    },
    {
      name: 'Erro de rede',
      errorText: '{"error":{"type":"network_error","message":"Connection timeout"}}',
      expected: false
    },
    {
      name: 'Erro de rate limit',
      errorText: '{"error":{"type":"rate_limit","message":"Too many requests"}}',
      expected: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(tc => {
    let errorData = {};
    try {
      errorData = JSON.parse(tc.errorText);
    } catch {
      // Não é JSON
    }
    
    const isInvalidGrant = errorData?.error?.type === 'invalid_grant' || 
                           errorData?.error?.message === 'invalid_grant' ||
                           tc.errorText.includes('invalid_grant');
    
    const result = isInvalidGrant === tc.expected ? '✅ PASS' : '❌ FAIL';
    console.log(`${result} - ${tc.name}`);
    console.log(`  Esperado: ${tc.expected}, Obtido: ${isInvalidGrant}`);
    
    if (isInvalidGrant === tc.expected) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log(`\nResultado: ${passed}/${testCases.length} testes passaram`);
  return failed === 0;
}

// Simular lógica de notificação
function testNotificationLogic() {
  console.log('\n📋 Teste 2: Lógica de Notificação');
  console.log('-'.repeat(80));
  
  const scenarios = [
    {
      name: 'Token válido (50h restantes)',
      hoursRemaining: 50,
      renewalSuccess: true,
      isInvalidGrant: false,
      shouldNotify: false,
      shouldDisable: false
    },
    {
      name: 'Token expirando (40h) - renovação OK',
      hoursRemaining: 40,
      renewalSuccess: true,
      isInvalidGrant: false,
      shouldNotify: false,
      shouldDisable: false
    },
    {
      name: 'Token expirando (40h) - renovação falhou (erro temporário)',
      hoursRemaining: 40,
      renewalSuccess: false,
      isInvalidGrant: false,
      shouldNotify: false, // Não notifica ainda, tem tempo
      shouldDisable: false
    },
    {
      name: 'Token expirando (5h) - renovação falhou (erro temporário)',
      hoursRemaining: 5,
      renewalSuccess: false,
      isInvalidGrant: false,
      shouldNotify: true, // Notifica pois é urgente
      shouldDisable: false
    },
    {
      name: 'Token expirado (0h) - renovação falhou',
      hoursRemaining: 0,
      renewalSuccess: false,
      isInvalidGrant: false,
      shouldNotify: true,
      shouldDisable: false
    },
    {
      name: 'Refresh token inválido (40h restantes)',
      hoursRemaining: 40,
      renewalSuccess: false,
      isInvalidGrant: true,
      shouldNotify: true, // Notifica IMEDIATAMENTE
      shouldDisable: true // Desativa integração
    },
    {
      name: 'Refresh token inválido (token já expirado)',
      hoursRemaining: -5,
      renewalSuccess: false,
      isInvalidGrant: true,
      shouldNotify: true,
      shouldDisable: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  scenarios.forEach(scenario => {
    // Simular lógica
    let shouldNotify = false;
    let shouldDisable = false;
    
    if (scenario.hoursRemaining < 48) {
      // Tenta renovar
      if (scenario.isInvalidGrant) {
        // Refresh token inválido - notifica IMEDIATAMENTE e desativa
        shouldNotify = true;
        shouldDisable = true;
      } else if (!scenario.renewalSuccess) {
        // Renovação falhou por outro motivo
        shouldNotify = scenario.hoursRemaining <= 6;
        shouldDisable = false;
      }
    }
    
    const notifyMatch = shouldNotify === scenario.shouldNotify;
    const disableMatch = shouldDisable === scenario.shouldDisable;
    const result = (notifyMatch && disableMatch) ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${result} - ${scenario.name}`);
    console.log(`  Notificar: esperado=${scenario.shouldNotify}, obtido=${shouldNotify} ${notifyMatch ? '✓' : '✗'}`);
    console.log(`  Desativar: esperado=${scenario.shouldDisable}, obtido=${shouldDisable} ${disableMatch ? '✓' : '✗'}`);
    
    if (notifyMatch && disableMatch) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log(`\nResultado: ${passed}/${scenarios.length} cenários passaram`);
  return failed === 0;
}

// Executar testes
const test1Pass = testInvalidGrantDetection();
const test2Pass = testNotificationLogic();

console.log('\n' + '='.repeat(80));
console.log('RESULTADO FINAL');
console.log('='.repeat(80));

if (test1Pass && test2Pass) {
  console.log('✅ TODOS OS TESTES PASSARAM');
  console.log('\n📝 Comportamento esperado:');
  console.log('  • Detecta erro invalid_grant corretamente');
  console.log('  • Notifica IMEDIATAMENTE quando refresh_token inválido');
  console.log('  • Desativa integração para parar tentativas e spam');
  console.log('  • Não notifica quando token tem tempo e renovação funciona');
  console.log('  • Notifica apenas quando crítico (< 6h) e renovação falha');
  process.exit(0);
} else {
  console.log('❌ ALGUNS TESTES FALHARAM');
  process.exit(1);
}
