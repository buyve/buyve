# 🔧 Supabase Realtime 디버깅 가이드

## 문제 상황
DB에는 1분마다 데이터가 저장되는데, 차트가 자동으로 업데이트되지 않음.

## 원인 분석
Supabase Realtime이 제대로 작동하지 않을 가능성이 높음.

---

## ✅ 체크리스트

### 1. Supabase Dashboard에서 Realtime 활성화 확인

**접속:** https://ozeooonqxrjvdoajgvnz.supabase.co

1. **Database** → **Replication** 메뉴로 이동
2. `token_price_history` 테이블을 찾아서 **Realtime 활성화** 확인
   - ✅ 활성화되어야 함 (체크박스 ON)
   - ❌ 비활성화되어 있으면 체크박스 클릭하여 활성화

3. **Database** → **Publications** 메뉴 확인
   - `supabase_realtime` publication에 `token_price_history` 테이블이 포함되어 있는지 확인

---

### 2. RLS (Row Level Security) 정책 확인

**Database** → **Tables** → `token_price_history` → **Policies**

다음 정책이 있어야 함:

```sql
-- SELECT 권한 (모든 사용자가 읽을 수 있도록)
CREATE POLICY "Allow public read access"
ON token_price_history
FOR SELECT
USING (true);
```

없으면 추가:
```sql
ALTER TABLE token_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON token_price_history
FOR SELECT
USING (true);
```

---

### 3. 브라우저 콘솔에서 실시간 로그 확인

수정된 코드를 배포한 후, 브라우저 개발자 도구 콘솔에서 다음 로그를 확인:

```
✅ 정상 작동 시:
🔔 Setting up Realtime channel for [토큰주소]
✅ Channel subscription status for [토큰주소]: SUBSCRIBED
🔥 DB Update detected for [토큰주소]: INSERT (또는 UPDATE)
💾 handleDatabaseUpdate called for [토큰주소]
📊 appendToChart called for [토큰주소]
📈 Chart updated: X -> Y points
✅ Price updated for [토큰주소]: [가격]
⏰ 1-minute interval update for [토큰주소] (1분마다)

❌ 문제 발생 시:
🔔 Setting up Realtime channel for [토큰주소]
❌ Channel subscription status for [토큰주소]: CHANNEL_ERROR
또는
✅ Channel subscription status for [토큰주소]: SUBSCRIBED
(하지만 이후 🔥 DB Update detected가 안 나옴)
```

---

### 4. 수동 테스트 방법

#### A. 크론 API 수동 호출
```bash
curl https://your-domain.vercel.app/api/cron/price-collector
```

#### B. Supabase SQL Editor에서 수동 INSERT
```sql
INSERT INTO token_price_history (
  token_address,
  price,
  open_price,
  high_price,
  low_price,
  close_price,
  timestamp_1min
) VALUES (
  'So11111111111111111111111111111111111111112',
  100.5,
  100.0,
  101.0,
  99.5,
  100.5,
  NOW()
);
```

위 쿼리 실행 후 브라우저 콘솔에서 `🔥 DB Update detected` 로그가 나오는지 확인.

---

### 5. Realtime 연결 테스트 코드

브라우저 콘솔에서 다음 코드 실행:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ozeooonqxrjvdoajgvnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96ZW9vb25xeHJqdmRvYWpndm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NDk1MjYsImV4cCI6MjA2NDMyNTUyNn0.d32Li6tfOvj96CKSfaVDkAKLK8WpGtFO9CiZf_cbY4Q'
);

const channel = supabase
  .channel('test-channel')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'token_price_history'
    },
    (payload) => {
      console.log('✅ Realtime event received:', payload);
    }
  )
  .subscribe((status) => {
    console.log('Channel status:', status);
  });
```

---

## 🚀 해결 방법

### 방법 1: Realtime이 비활성화된 경우
Supabase Dashboard에서 `token_price_history` 테이블의 Realtime 활성화.

### 방법 2: RLS 정책 문제
위의 SQL 쿼리로 public read access 정책 추가.

### 방법 3: Realtime이 정상이지만 차트가 안 보이는 경우
- 브라우저 캐시 삭제 후 새로고침
- 크론이 실제로 1분마다 실행되는지 Vercel 대시보드에서 확인

---

## 📝 다음 단계

1. Supabase Dashboard에서 Realtime 활성화
2. 배포 후 브라우저 콘솔 로그 확인
3. 1분 기다린 후 차트가 자동으로 업데이트되는지 확인
4. 문제가 계속되면 위의 수동 테스트 실행

---

## 🔗 유용한 링크

- Supabase Dashboard: https://ozeooonqxrjvdoajgvnz.supabase.co
- Supabase Realtime 문서: https://supabase.com/docs/guides/realtime
- Vercel Cron 로그: https://vercel.com/dashboard/crons
