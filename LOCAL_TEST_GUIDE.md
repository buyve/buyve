# 🧪 로컬에서 실시간 차트 업데이트 테스트 가이드

## ✅ 현재 상태
- 로컬 서버 실행 중: http://localhost:3000
- 크론 API 수동 호출 성공: 4개 토큰 가격 저장 완료

---

## 📋 테스트 순서

### 1단계: 브라우저에서 앱 접속
```
http://localhost:3000
```

### 2단계: 채팅방 입장
- 아무 채팅방이나 선택하여 입장 (토큰이 있는 방)

### 3단계: 개발자 도구 열기
- **Mac**: `Cmd + Option + I`
- **Windows**: `F12`
- Console 탭 선택

### 4단계: Realtime 구독 로그 확인
채팅방 입장 시 다음 로그가 나와야 함:
```
🔔 Setting up Realtime channel for [토큰주소]
✅ Channel subscription status for [토큰주소]: SUBSCRIBED
```

**문제 발생 시:**
- ❌ `CHANNEL_ERROR` → Supabase Realtime 비활성화
- ❌ `TIMED_OUT` → 네트워크 문제

---

### 5단계: 크론 API 수동 호출 (터미널에서)

**옵션 A: 새 터미널 창에서**
```bash
curl http://localhost:3000/api/cron/price-collector
```

**옵션 B: 1분마다 자동 호출 (백그라운드)**
```bash
# Mac/Linux
while true; do curl http://localhost:3000/api/cron/price-collector; sleep 60; done

# Windows (PowerShell)
while($true) { Invoke-WebRequest http://localhost:3000/api/cron/price-collector; Start-Sleep 60 }
```

---

### 6단계: 브라우저 콘솔에서 Realtime 업데이트 로그 확인

API 호출 직후 다음 로그가 나와야 함:

```
✅ 정상 작동 시:
🔥 DB Update detected for [토큰주소]: UPDATE (또는 INSERT)
💾 handleDatabaseUpdate called for [토큰주소]: { ... }
📊 appendToChart called for [토큰주소]
📈 Chart updated: 10 -> 11 points
✅ Price updated for [토큰주소]: 100.5
```

**동시에 화면에서:**
- 💹 가격 숫자가 자동으로 변경
- 📊 차트에 새로운 점이 추가

---

## 🔍 문제 해결

### 문제 1: 구독은 되는데 업데이트 로그가 안 나옴
```
✅ Channel subscription status: SUBSCRIBED
(하지만 🔥 DB Update detected가 안 나옴)
```

**원인:** Supabase Realtime이 테이블에서 비활성화됨

**해결:**
1. https://ozeooonqxrjvdoajgvnz.supabase.co 접속
2. Database → Replication
3. `token_price_history` 테이블의 Realtime 체크박스 활성화

---

### 문제 2: 1분 주기 폴링은 작동하지만 Realtime은 안됨
```
⏰ 1-minute interval update for [토큰주소]  (← 이건 나옴)
🔥 DB Update detected  (← 이건 안 나옴)
```

**원인:** RLS 정책 문제

**해결:** Supabase SQL Editor에서 실행
```sql
-- RLS 활성화
ALTER TABLE token_price_history ENABLE ROW LEVEL SECURITY;

-- Public read access 정책 추가
CREATE POLICY "Allow public read access"
ON token_price_history
FOR SELECT
USING (true);
```

---

### 문제 3: 차트가 아예 안 보임
**원인:** DB에 데이터가 없음

**해결:** 크론 API 여러 번 호출
```bash
# 3번 호출 (3분치 데이터 생성)
curl http://localhost:3000/api/cron/price-collector
sleep 60
curl http://localhost:3000/api/cron/price-collector
sleep 60
curl http://localhost:3000/api/cron/price-collector
```

---

## 📊 예상 결과

### 초기 상태 (데이터 없음)
```
┌─────────────────┐
│ --              │  ← 가격 표시 없음
│                 │
└─────────────────┘
```

### 3분 후 (3개 데이터 포인트)
```
┌─────────────────┐
│ $100.5 +2.5%    │  ← 실시간 가격
│      ●─●─●      │  ← 차트 표시
└─────────────────┘
```

---

## 🎯 완전 자동 테스트 (추천)

**터미널 1:** 개발 서버 (이미 실행 중)
```bash
npm run dev
```

**터미널 2:** 1분마다 자동 API 호출
```bash
while true; do
  echo "$(date) - Calling price collector..."
  curl -s http://localhost:3000/api/cron/price-collector | jq
  sleep 60
done
```

**브라우저:**
- http://localhost:3000 접속
- 채팅방 입장
- F12 → Console 탭
- 1분마다 로그 확인

---

## ✅ 테스트 체크리스트

- [ ] 로컬 서버 실행 중
- [ ] 브라우저에서 앱 접속
- [ ] 채팅방 입장
- [ ] F12 개발자 도구 열기
- [ ] Console에 `🔔 Setting up Realtime channel` 로그 확인
- [ ] `✅ Channel subscription status: SUBSCRIBED` 확인
- [ ] 터미널에서 크론 API 호출
- [ ] 브라우저 Console에 `🔥 DB Update detected` 로그 확인
- [ ] 차트에 새로운 점 추가됨 확인
- [ ] 가격 숫자 변경됨 확인

---

## 🚨 문제가 계속되면?

1. 브라우저 콘솔 로그 전체 복사
2. 네트워크 탭에서 WebSocket 연결 확인
3. Supabase Dashboard에서 Realtime 활성화 재확인
