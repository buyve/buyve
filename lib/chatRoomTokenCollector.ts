import { supabase } from './supabase';
import { tokenPriceService } from './tokenPriceService';

// 🏠 채팅방 토큰 수집 서비스
export class ChatRoomTokenCollector {
  
  /**
   * 모든 채팅방에서 토큰 주소를 수집합니다
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
   * 특정 채팅방의 토큰 주소를 가져옵니다
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
   * 채팅방 토큰들의 가격 데이터를 일괄 수집합니다
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

      // 각 토큰의 가격 업데이트 실행
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
   * 새로운 채팅방이 생성될 때 토큰 주소를 등록하고 즉시 가격 수집을 시작합니다
   */
  async onNewChatRoomCreated(roomId: string, tokenAddress?: string): Promise<boolean> {
    try {
      if (!tokenAddress) {
        return true;
      }

      
      // 즉시 가격 수집 시작
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
   * 활성 채팅방들의 토큰만 수집합니다
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

// 싱글톤 인스턴스
export const chatRoomTokenCollector = new ChatRoomTokenCollector();

export default chatRoomTokenCollector; 