-- ============================================================================
-- OHLC 원자적 업데이트를 위한 PostgreSQL 함수
-- ============================================================================
-- 이 함수는 토큰 가격 히스토리를 1분 단위로 원자적으로 upsert하며,
-- 동시성 문제 없이 OHLC(Open, High, Low, Close) 데이터를 정확하게 유지합니다.

CREATE OR REPLACE FUNCTION upsert_token_price_ohlc(
  p_token_address TEXT,
  p_price NUMERIC,
  p_timestamp_1min TIMESTAMP WITH TIME ZONE,
  p_volume NUMERIC DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- ON CONFLICT를 사용한 원자적 UPSERT
  -- 동일한 (token_address, timestamp_1min) 조합이 존재하면 OHLC 업데이트
  -- 존재하지 않으면 새로운 레코드 삽입
  INSERT INTO token_price_history (
    token_address,
    price,
    open_price,
    high_price,
    low_price,
    close_price,
    timestamp_1min,
    volume
  )
  VALUES (
    p_token_address,
    p_price,
    p_price,  -- open_price
    p_price,  -- high_price
    p_price,  -- low_price
    p_price,  -- close_price
    p_timestamp_1min,
    p_volume
  )
  ON CONFLICT (token_address, timestamp_1min)
  DO UPDATE SET
    price = p_price,
    close_price = p_price,
    -- GREATEST/LEAST로 원자적으로 high/low 계산
    high_price = GREATEST(token_price_history.high_price, p_price),
    low_price = LEAST(token_price_history.low_price, p_price),
    volume = token_price_history.volume + p_volume;
END;
$$;

-- ============================================================================
-- 배치 UPSERT를 위한 PostgreSQL 함수
-- ============================================================================
-- 여러 토큰의 가격을 한 번에 원자적으로 업데이트합니다.

CREATE OR REPLACE FUNCTION upsert_token_prices_batch(
  p_data JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item JSONB;
BEGIN
  -- JSONB 배열의 각 항목을 순회하며 upsert
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
    PERFORM upsert_token_price_ohlc(
      (v_item->>'token_address')::TEXT,
      (v_item->>'price')::NUMERIC,
      (v_item->>'timestamp_1min')::TIMESTAMP WITH TIME ZONE,
      COALESCE((v_item->>'volume')::NUMERIC, 0)
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 인덱스 최적화
-- ============================================================================
-- 기존 인덱스가 없는 경우에만 생성

DO $$
BEGIN
  -- (token_address, timestamp_1min) 복합 유니크 인덱스
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_token_price_history_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_token_price_history_unique
    ON token_price_history (token_address, timestamp_1min);
  END IF;

  -- token_address 단일 조회 최적화
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_token_price_history_address'
  ) THEN
    CREATE INDEX idx_token_price_history_address
    ON token_price_history (token_address);
  END IF;

  -- timestamp_1min 시간순 조회 최적화
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_token_price_history_timestamp'
  ) THEN
    CREATE INDEX idx_token_price_history_timestamp
    ON token_price_history (timestamp_1min DESC);
  END IF;
END $$;

-- ============================================================================
-- 사용 예시
-- ============================================================================
-- 1. 단일 가격 업데이트:
-- SELECT upsert_token_price_ohlc(
--   'So11111111111111111111111111111111111111112',
--   150.25,
--   '2025-01-01 00:00:00+00',
--   0
-- );

-- 2. 배치 업데이트:
-- SELECT upsert_token_prices_batch('[
--   {
--     "token_address": "So11111111111111111111111111111111111111112",
--     "price": 150.25,
--     "timestamp_1min": "2025-01-01 00:00:00+00",
--     "volume": 0
--   },
--   {
--     "token_address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
--     "price": 1.0,
--     "timestamp_1min": "2025-01-01 00:00:00+00",
--     "volume": 0
--   }
-- ]'::jsonb);
