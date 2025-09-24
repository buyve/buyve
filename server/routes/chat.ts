import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../../lib/supabase';
import { CreateMessageRequest, ChatMessage, ChatRoom } from '../types/database';

const router = Router();

// 채팅방 목록 조회
router.get('/rooms', async (req: Request, res: Response) => {
  try {
    const { data: rooms, error } = await supabaseAdmin
      .from('chat_rooms')
      .select(`
        id,
        name,
        description,
        image,
        token_address,
        created_by,
        member_count,
        is_active,
        created_at,
        updated_at,
        chat_messages (
          id,
          content,
          created_at,
          user_address,
          trade_type
        )
      `)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // 최신 메시지 처리
    const roomsWithLastMessage = rooms?.map(room => ({
      ...room,
      last_message: room.chat_messages?.[0] || null
    }));
    
    res.json({ success: true, data: roomsWithLastMessage });
  } catch {
    res.status(500).json({ success: false, error: '채팅방 목록을 가져올 수 없습니다' });
  }
});

// 특정 채팅방 메시지 조회
router.get('/rooms/:roomId/messages', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // roomId가 string이면 UUID로 변환
    let actualRoomId = roomId;
    if (roomId === 'sol-usdc' || roomId === 'btc-chat' || roomId === 'general') {
      const { data: uuidResult } = await supabaseAdmin
        .rpc('get_room_uuid', { room_name: roomId });
      actualRoomId = uuidResult;
    }

    const offset = (Number(page) - 1) * Number(limit);
    
    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select(`
        id,
        room_id,
        user_id,
        user_address,
        nickname,
        avatar,
        content,
        trade_type,
        trade_amount,
        tx_hash,
        created_at
      `)
      .eq('room_id', actualRoomId)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    
    if (error) throw error;
    
    // 최신 순으로 다시 정렬
    const sortedMessages = messages?.reverse() || [];
    
    res.json({ success: true, data: sortedMessages });
  } catch {
    res.status(500).json({ success: false, error: '메시지를 가져올 수 없습니다' });
  }
});

// 메시지 전송
router.post('/rooms/:roomId/messages', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const messageData: CreateMessageRequest = req.body;
    
    // roomId가 string이면 UUID로 변환
    let actualRoomId = roomId;
    if (roomId === 'sol-usdc' || roomId === 'btc-chat' || roomId === 'general') {
      const { data: uuidResult } = await supabaseAdmin
        .rpc('get_room_uuid', { room_name: roomId });
      actualRoomId = uuidResult;
    }

    // 사용자 ID 생성 (임시)
    const userId = messageData.user_address.slice(0, 8);
    
    const { data: newMessage, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        room_id: actualRoomId,
        user_id: userId,
        user_address: messageData.user_address,
        nickname: messageData.nickname,
        avatar: messageData.avatar,
        content: messageData.content,
        trade_type: messageData.trade_type,
        trade_amount: messageData.trade_amount,
        tx_hash: messageData.tx_hash
      })
      .select()
      .single();

    if (error) throw error;

    // Supabase Realtime으로 실시간 브로드캐스트
    await supabaseAdmin
      .from('message_cache')
      .insert({
        token_address: actualRoomId,
        message_type: messageData.trade_type || 'CHAT',
        content: messageData.content,
        user_address: messageData.user_address,
        nickname: messageData.nickname,
        avatar: messageData.avatar,
        trade_amount: messageData.trade_amount,
        tx_hash: messageData.tx_hash
      });

    res.json({ success: true, data: newMessage });
  } catch {
    res.status(500).json({ success: false, error: '메시지 전송에 실패했습니다' });
  }
});

// 채팅방 생성
router.post('/rooms', async (req: Request, res: Response) => {
  try {
    const { name, description, image = '🎯', token_address, created_by } = req.body;
    
    const { data: newRoom, error } = await supabaseAdmin
      .from('chat_rooms')
      .insert({
        name,
        description,
        image,
        token_address,
        created_by
      })
      .select()
      .single();

    if (error) throw error;
    
    // Supabase Realtime이 자동으로 처리
    res.json({ success: true, data: newRoom });
  } catch {
    res.status(500).json({ success: false, error: '채팅방 생성에 실패했습니다' });
  }
});

export default router; 