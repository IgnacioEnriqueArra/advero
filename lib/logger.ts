import { supabase } from './supabaseClient';

export type LogType = 'INFO' | 'WARNING' | 'ERROR' | 'REVENUE' | 'SYSTEM' | 'SECURITY';

interface LogOptions {
  type: LogType;
  event: string;
  message: string;
  metadata?: any;
  screen_id?: string;
  owner_id?: string;
}

export const logger = {
  async log(options: LogOptions) {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .insert([{
          type: options.type,
          event: options.event,
          message: options.message,
          metadata: options.metadata || {},
          screen_id: options.screen_id,
          owner_id: options.owner_id
        }]);

      if (error) console.error('Logger Error:', error);
    } catch (e) {
      console.error('Logger Exception:', e);
    }
  },

  async recordTransaction(amount: number, screenId: string, mediaId?: string, payerDetails?: any) {
    try {
      // 1. Log the revenue event
      await this.log({
        type: 'REVENUE',
        event: 'PAYMENT_RECEIVED',
        message: `Pago recibido: $${amount}`,
        metadata: { amount, mediaId },
        screen_id: screenId
      });

      // 2. Insert into transactions table (Immutable financial record)
      const { error } = await supabase
        .from('transactions')
        .insert([{
          amount,
          screen_id: screenId,
          media_id: mediaId,
          status: 'completed',
          payer_details: payerDetails || {}
        }]);

      if (error) console.error('Transaction Error:', error);

    } catch (e) {
      console.error('Transaction Exception:', e);
    }
  }
};
