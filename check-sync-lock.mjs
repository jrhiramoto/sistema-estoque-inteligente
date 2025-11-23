import { getCurrentSync } from './server/syncManager.ts';

const status = getCurrentSync();
console.log('Status da sincronização:');
console.log(JSON.stringify(status, null, 2));
