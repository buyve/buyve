-- ============================================================================
-- 1분마다 토큰 가격을 수집하는 pg_cron 설정
-- ============================================================================

-- pg_cron extension 활성화 (이미 활성화되어 있으면 무시됨)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 가격 수집을 위한 PostgreSQL 함수
-- ============================================================================
-- Jupiter API를 호출하여 토큰 가격을 수집하고 DB에 저장합니다.

CREATE OR REPLACE FUNCTION collect_token_prices()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_token_address TEXT;
  v_price NUMERIC;
  v_timestamp_1min TIMESTAMP WITH TIME ZONE;
  v_response TEXT;
  v_token TEXT;
  v_jupiter_url TEXT;
  v_price_data JSONB;
  v_all_tokens TEXT;
  v_token_count INTEGER := 0;
BEGIN
  -- 현재 시간을 1분 단위로 정규화
  v_timestamp_1min := date_trunc('minute', NOW());

  -- DB에 등록된 모든 토큰 주소 수집
  -- 1. 기본 토큰 (DEFAULT_TOKENS)
  -- 2. 채팅방에서 사용 중인 토큰 (chat_rooms 테이블)
  -- 3. 가격 히스토리가 있는 토큰 (token_price_history 테이블)
  FOR v_token IN
    SELECT DISTINCT token_address
    FROM (
      -- 기본 토큰
      SELECT unnest(ARRAY[
        'So11111111111111111111111111111111111111112',  -- SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', -- USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', -- USDT
        '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', -- ETH
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'  -- BONK
      ]) AS token_address

      UNION

      -- 채팅방에서 사용 중인 토큰
      SELECT token_address
      FROM chat_rooms
      WHERE token_address IS NOT NULL

      UNION

      -- 가격 히스토리가 있는 토큰 (최근 7일 이내)
      SELECT DISTINCT token_address
      FROM token_price_history
      WHERE timestamp_1min >= NOW() - INTERVAL '7 days'
    ) AS all_tokens
  LOOP
    BEGIN
      -- Jupiter API URL 생성
      v_jupiter_url := 'https://price.jup.ag/v6/price?ids=' || v_token;

      -- HTTP GET 요청 (http extension 필요)
      SELECT content::jsonb INTO v_price_data
      FROM http_get(v_jupiter_url);

      -- 가격 추출
      v_price := (v_price_data->'data'->v_token->>'price')::NUMERIC;

      -- 가격이 유효한 경우에만 저장
      IF v_price IS NOT NULL AND v_price > 0 THEN
        PERFORM upsert_token_price_ohlc(
          v_token,
          v_price,
          v_timestamp_1min,
          0
        );

        v_token_count := v_token_count + 1;
        RAISE NOTICE '✅ 토큰 % 가격 수집 완료: $%', v_token, v_price;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ 토큰 % 가격 수집 실패: %', v_token, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '🎯 가격 수집 완료: % (총 %개 토큰)', v_timestamp_1min, v_token_count;
END;
$$;

-- ============================================================================
-- HTTP extension 활성화
-- ============================================================================
-- Jupiter API 호출을 위해 필요합니다.

CREATE EXTENSION IF NOT EXISTS http;

-- ============================================================================
-- pg_cron 스케줄 설정
-- ============================================================================
-- 기존 스케줄 삭제 (있을 경우)
SELECT cron.unschedule('collect-token-prices-every-minute')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'collect-token-prices-every-minute'
);

-- 1분마다 가격 수집 실행
SELECT cron.schedule(
  'collect-token-prices-every-minute',  -- job name
  '* * * * *',                          -- 매 1분마다 실행 (cron expression)
  $$SELECT collect_token_prices()$$     -- 실행할 SQL
);

-- ============================================================================
-- 테스트
-- ============================================================================
-- 수동으로 함수를 실행하여 테스트할 수 있습니다:
-- SELECT collect_token_prices();

-- 스케줄된 작업 확인:
-- SELECT * FROM cron.job WHERE jobname = 'collect-token-prices-every-minute';

-- 작업 실행 히스토리 확인:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'collect-token-prices-every-minute')
-- ORDER BY start_time DESC
-- LIMIT 10;
