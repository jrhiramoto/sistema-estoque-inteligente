/**
 * Teste do Sistema de Cooldown de Notificações
 * 
 * Valida que notificações de token expirado respeitam cooldown de 24h
 */

console.log('\n🧪 TESTE DO SISTEMA DE COOLDOWN DE NOTIFICAÇÕES\n');

// Cenários de teste
const scenarios = [
  {
    name: '1. Token urgente (< 6h) + Nunca notificou',
    hoursRemaining: 5,
    lastNotificationSent: null,
    expected: true,
    reason: 'Primeira notificação urgente deve ser enviada'
  },
  {
    name: '2. Token urgente (< 6h) + Notificou há 1h',
    hoursRemaining: 5,
    lastNotificationSent: new Date(Date.now() - 1 * 60 * 60 * 1000),
    expected: false,
    reason: 'Cooldown de 24h ainda ativo'
  },
  {
    name: '3. Token urgente (< 6h) + Notificou há 23h',
    hoursRemaining: 5,
    lastNotificationSent: new Date(Date.now() - 23 * 60 * 60 * 1000),
    expected: false,
    reason: 'Cooldown de 24h ainda ativo (falta 1h)'
  },
  {
    name: '4. Token urgente (< 6h) + Notificou há 24h',
    hoursRemaining: 5,
    lastNotificationSent: new Date(Date.now() - 24 * 60 * 60 * 1000),
    expected: true,
    reason: 'Cooldown expirou, pode notificar novamente'
  },
  {
    name: '5. Token urgente (< 6h) + Notificou há 48h',
    hoursRemaining: 5,
    lastNotificationSent: new Date(Date.now() - 48 * 60 * 60 * 1000),
    expected: true,
    reason: 'Cooldown expirou há muito tempo'
  },
  {
    name: '6. Token não urgente (10h) + Nunca notificou',
    hoursRemaining: 10,
    lastNotificationSent: null,
    expected: false,
    reason: 'Token não urgente ainda, aguardar'
  },
  {
    name: '7. Token expirado (0h) + Notificou há 1h',
    hoursRemaining: 0,
    lastNotificationSent: new Date(Date.now() - 1 * 60 * 60 * 1000),
    expected: false,
    reason: 'Mesmo expirado, respeita cooldown'
  },
  {
    name: '8. Token expirado (0h) + Notificou há 25h',
    hoursRemaining: 0,
    lastNotificationSent: new Date(Date.now() - 25 * 60 * 60 * 1000),
    expected: true,
    reason: 'Expirado + cooldown expirou = notificar'
  }
];

// Lógica de decisão (copiada do tokenRenewalJob.ts)
function shouldNotify(hoursRemaining, lastNotificationSent) {
  const now = new Date();
  const lastNotification = lastNotificationSent ? new Date(lastNotificationSent) : null;
  const hoursSinceLastNotification = lastNotification 
    ? Math.floor((now.getTime() - lastNotification.getTime()) / (1000 * 60 * 60))
    : 999; // Se nunca enviou, considerar muito tempo atrás
  
  const isUrgent = hoursRemaining <= 6;
  const cooldownExpired = hoursSinceLastNotification >= 24;
  return isUrgent && cooldownExpired;
}

// Executar testes
let passed = 0;
let failed = 0;

scenarios.forEach((scenario, index) => {
  const result = shouldNotify(scenario.hoursRemaining, scenario.lastNotificationSent);
  const success = result === scenario.expected;
  
  if (success) {
    console.log(`✅ ${scenario.name}`);
    console.log(`   Resultado: ${result ? 'NOTIFICAR' : 'NÃO NOTIFICAR'} (esperado)`);
    console.log(`   Motivo: ${scenario.reason}\n`);
    passed++;
  } else {
    console.log(`❌ ${scenario.name}`);
    console.log(`   Resultado: ${result ? 'NOTIFICAR' : 'NÃO NOTIFICAR'} (esperado: ${scenario.expected ? 'NOTIFICAR' : 'NÃO NOTIFICAR'})`);
    console.log(`   Motivo: ${scenario.reason}\n`);
    failed++;
  }
});

// Resumo
console.log('━'.repeat(60));
console.log(`\n📊 RESUMO: ${passed}/${scenarios.length} testes passaram\n`);

if (failed === 0) {
  console.log('✅ TODOS OS TESTES PASSARAM!');
  console.log('\nSistema de cooldown funcionando corretamente:');
  console.log('• Notifica apenas quando urgente (< 6h)');
  console.log('• Respeita cooldown de 24h entre notificações');
  console.log('• Previne spam mesmo com token expirado');
  process.exit(0);
} else {
  console.log(`❌ ${failed} TESTE(S) FALHARAM`);
  process.exit(1);
}
