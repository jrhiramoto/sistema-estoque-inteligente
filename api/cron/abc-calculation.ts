import type { VercelRequest, VercelResponse } from '@vercel/node';
import { performAbcAutoCalculation } from '../../server/abcAutoCalculationJob';

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
    console.log('[Cron] Starting ABC auto calculation...');
    await performAbcAutoCalculation();
    console.log('[Cron] ABC auto calculation completed successfully');
    
    return res.status(200).json({ 
      success: true,
      message: 'ABC auto calculation completed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron] ABC auto calculation failed:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
