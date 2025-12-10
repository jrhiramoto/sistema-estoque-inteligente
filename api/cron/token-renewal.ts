import type { VercelRequest, VercelResponse } from '@vercel/node';
import { performTokenRenewal } from '../../server/tokenRenewalJob';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Cron] Starting token renewal...');
    await performTokenRenewal();
    console.log('[Cron] Token renewal completed successfully');
    
    return res.status(200).json({ 
      success: true,
      message: 'Token renewal completed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron] Token renewal failed:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
