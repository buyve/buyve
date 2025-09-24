-- 채팅방 테이블
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(255) DEFAULT '🎯',
    token_address VARCHAR(255),
    created_by VARCHAR(255) NOT NULL,
    member_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 인덱스 생성
    INDEX idx_chat_rooms_token_address (token_address)
);

-- 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS profiles (
    wallet_address VARCHAR(255) PRIMARY KEY,
    nickname VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 토큰 가격 히스토리 테이블 (60개 포인트까지 저장)
CREATE TABLE IF NOT EXISTS token_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(255) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    open_price DECIMAL(20, 8) NOT NULL,
    high_price DECIMAL(20, 8) NOT NULL,
    low_price DECIMAL(20, 8) NOT NULL,
    close_price DECIMAL(20, 8) NOT NULL,
    timestamp_1min TIMESTAMP WITH TIME ZONE NOT NULL, -- 1분 단위로 정규화된 시간
    volume DECIMAL(20, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 인덱스 생성
    INDEX idx_token_timestamp (token_address, timestamp_1min),
    INDEX idx_price_history_timestamp (timestamp_1min DESC),
    
    -- 유니크 제약조건 (토큰별 1분 단위당 하나의 데이터만)
    UNIQUE(token_address, timestamp_1min)
);

-- 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    user_address VARCHAR(255) NOT NULL,
    nickname VARCHAR(255),
    avatar VARCHAR(255),
    content TEXT NOT NULL,
    trade_type VARCHAR(10) CHECK (trade_type IN ('buy', 'sell')) NOT NULL,
    trade_amount VARCHAR(255),
    tx_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 인덱스 생성
    INDEX idx_room_created (room_id, created_at),
    INDEX idx_user_address (user_address),
    INDEX idx_tx_hash (tx_hash)
);

-- 기본 채팅방 데이터 추가
INSERT INTO chat_rooms (id, name, description, image, token_address, created_by) 
VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'SOL/USDC', 'Solana to USDC trading room', '🚀', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'system'),
    ('550e8400-e29b-41d4-a716-446655440001', 'BTC Discussion', 'Bitcoin price discussion', '₿', null, 'system'),
    ('550e8400-e29b-41d4-a716-446655440002', 'General Chat', 'General crypto discussion', '💬', null, 'system')
ON CONFLICT (id) DO NOTHING;

-- room_id를 고정 값으로 매핑하는 함수 (기존 UI 호환성)
CREATE OR REPLACE FUNCTION get_room_uuid(room_name TEXT)
RETURNS UUID AS $$
BEGIN
    RETURN CASE 
        WHEN room_name = 'sol-usdc' THEN '550e8400-e29b-41d4-a716-446655440000'::UUID
        WHEN room_name = 'btc-chat' THEN '550e8400-e29b-41d4-a716-446655440001'::UUID
        WHEN room_name = 'general' THEN '550e8400-e29b-41d4-a716-446655440002'::UUID
        ELSE '550e8400-e29b-41d4-a716-446655440000'::UUID -- 기본값
    END;
END;
$$ LANGUAGE plpgsql;

-- 가격 히스토리 정리 함수 (60개 초과 데이터 삭제)
CREATE OR REPLACE FUNCTION cleanup_old_price_history()
RETURNS TRIGGER AS $$
BEGIN
    -- 각 토큰별로 60개 초과 데이터를 삭제
    DELETE FROM token_price_history 
    WHERE token_address = NEW.token_address 
    AND timestamp_1min NOT IN (
        SELECT timestamp_1min 
        FROM token_price_history 
        WHERE token_address = NEW.token_address 
        ORDER BY timestamp_1min DESC 
        LIMIT 60
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 새 가격 데이터 삽입 시 자동으로 오래된 데이터 정리
CREATE TRIGGER cleanup_price_history_trigger
    AFTER INSERT ON token_price_history
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_old_price_history();

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_rooms_updated_at
    BEFORE UPDATE ON chat_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 1분 단위로 시간 정규화하는 함수
CREATE OR REPLACE FUNCTION normalize_to_1min(input_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN date_trunc('minute', input_timestamp);
END;
$$ LANGUAGE plpgsql;

 