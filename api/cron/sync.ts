import type { VercelRequest, VercelResponse } from '@vercel/node';
import { performScheduledSync } from '../../server/scheduledSync';

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
    console.log('[Cron] Starting scheduled sync...');
    await performScheduledSync();
    console.log('[Cron] Scheduled sync completed successfully');
    
    return res.status(200).json({ 
      success: true,
      message: 'Scheduled sync completed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron] Scheduled sync failed:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
