import { supabase } from './supabase';
import { tokenPriceService } from './tokenPriceService';

// Chat room token collection service
export class ChatRoomTokenCollector {

  /**
   * Collect token addresses from all chat rooms
   */
  async getAllChatRoomTokens(): Promise<string[]> {
    try {
      
      const { data: chatRooms, error } = await supabase
        .from('chat_rooms')
        .select('id, name, token_address')
        .not('token_address', 'is', null)
        .neq('token_address', '');

      if (error) {
        return [];
      }

      const tokenAddresses = chatRooms
        ?.map(room => room.token_address)
        .filter((address): address is string => !!address) || [];

      const uniqueTokens = [...new Set(tokenAddresses)];
      

      return uniqueTokens;
    } catch {
      return [];
    }
  }

  /**
   * Get token address for a specific chat room
   */
  async getChatRoomToken(roomId: string): Promise<string | null> {
    try {
      const { data: room, error } = await supabase
        .from('chat_rooms')
        .select('token_address')
        .eq('id', roomId)
        .single();

      if (error || !room?.token_address) {
        return null;
      }

      return room.token_address;
    } catch {
      return null;
    }
  }

  /**
   * Collect price data for chat room tokens in batch
   */
     async collectAllChatRoomTokenPrices(): Promise<{
     success: boolean;
     totalTokens: number;
     successfulUpdates: number;
     failedTokens: string[];
     details: Array<{
       tokenAddress: string;
       success: boolean;
       error: string | null;
     }>;
   }> {
    try {
      
      const tokenAddresses = await this.getAllChatRoomTokens();
      
      if (tokenAddresses.length === 0) {
        return {
          success: true,
          totalTokens: 0,
          successfulUpdates: 0,
          failedTokens: [],
          details: []
        };
      }

      // Execute price updates for each token
      const updatePromises = tokenAddresses.map(async (tokenAddress) => {
        try {
          const success = await tokenPriceService.updateTokenPrice(tokenAddress);
          return {
            tokenAddress,
            success,
            error: null
          };
        } catch (error) {
          return {
            tokenAddress,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const results = await Promise.all(updatePromises);
      
      const successfulUpdates = results.filter(r => r.success).length;
      const failedTokens = results.filter(r => !r.success).map(r => r.tokenAddress);
      
      
      if (failedTokens.length > 0) {
      }

      return {
        success: true,
        totalTokens: tokenAddresses.length,
        successfulUpdates,
        failedTokens,
        details: results
      };

    } catch {
      return {
        success: false,
        totalTokens: 0,
        successfulUpdates: 0,
        failedTokens: [],
        details: []
      };
    }
  }

  /**
   * Register token address and start price collection when a new chat room is created
   */
  async onNewChatRoomCreated(roomId: string, tokenAddress?: string): Promise<boolean> {
    try {
      if (!tokenAddress) {
        return true;
      }


      // Start price collection immediately
      const success = await tokenPriceService.updateTokenPrice(tokenAddress);
      
      if (success) {
      } else {
      }

      return success;
    } catch {
      return false;
    }
  }

  /**
   * Collect tokens only from active chat rooms
   */
  async collectActiveChatRoomTokens(): Promise<string[]> {
    try {
      const { data: activeRooms, error } = await supabase
        .from('chat_rooms')
        .select('token_address')
        .eq('is_active', true)
        .not('token_address', 'is', null)
        .neq('token_address', '');

      if (error) {
        return [];
      }

      const tokens = activeRooms
        ?.map(room => room.token_address)
        .filter((address): address is string => !!address) || [];

      return [...new Set(tokens)];
    } catch {
      return [];
    }
  }
}

// Singleton instance
export const chatRoomTokenCollector = new ChatRoomTokenCollector();

export default chatRoomTokenCollector; 