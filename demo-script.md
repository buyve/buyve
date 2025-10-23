# 🎬 Solana Hackathon Technical Demo Script

## INTRO (10 seconds)

### English
"Hey everyone! So today I'm gonna show you how we built this simple platform where instead of tipping streamers with money that just disappears, you can actually trade on the Solana blockchain while sending messages at the same time, and all the history is stored on-chain. Let's jump right in."


### 한국어
"안녕하세요 여러분! 오늘은 스트리머한테 그냥 사라지는 팁을 주는 대신, 실제로 솔라나 체인 위에서 거래하는 동시에 메시지를 보낼 수 있고 모든 내역이 블록체인에 저장되는 간단한 플랫폼을 어떻게 만들었는지 보여드릴게요. 바로 시작할게요."


## SCENE 1: Wallet Connection (15 seconds)

### English
"First, I'll connect my Phantom wallet. We're using Wallet Adapter, so this works with any Solana wallet. Once connected, we get the wallet address, signing capability, and RPC connection with WebSocket for real time updates."

### 한국어
"먼저 Phantom 지갑을 연결할게요. Wallet Adapter를 쓰기 때문에 어떤 솔라나 지갑이든 작동해요. 연결되면 지갑 주소, 서명 기능, 그리고 실시간 업데이트를 위한 WebSocket RPC 연결을 받아요."

## SCENE 2: The Trade Transaction (55 seconds)

### English
"Now let's trade point zero one SOL with a message.

<break time="0.5s" />

Type 'First trade' and click buy button

<break time="0.5s" />

We're using Jupiter V6 API. Most swap APIs make you query each DEX separately and build every instruction manually. Jupiter makes it simple. We just send input token, output token, amount, and platform fee.

Jupiter checks over twenty liquidity sources at once and finds the best route. The cool part is it handles our platform fee automatically. We just pass platformFeeBps and Jupiter includes the fee split in the transaction.

It returns a fully optimized transaction. We add one more instruction which is the Memo Program to store our message First trade. Everything's atomic so the swap, fee, and message all succeed together or fail together.

Done! Trade executed, fee collected, message on chain. All in one transaction."

### 한국어
"이제 메시지와 함께 영점영일 SOL을 거래해볼게요.

[First trade 입력하고 buy 버튼 클릭]

Jupiter V6 API를 쓰고 있어요. 대부분의 스왑 API는 각 DEX를 따로 쿼리하고 모든 인스트럭션을 직접 만들어야 해요. Jupiter는 간단해요. 입력 토큰, 출력 토큰, 금액, 플랫폼 수수료만 보내면 돼요.

Jupiter가 스무 개 이상의 유동성 소스를 한 번에 확인하고 최적 경로를 찾아요. 멋진 건 플랫폼 수수료를 자동으로 처리한다는 거예요. platformFeeBps만 전달하면 Jupiter가 트랜잭션에 수수료 분할을 포함시켜요.

완전히 최적화된 트랜잭션을 돌려줘요. 우리는 인스트럭션 하나만 추가하면 되는데, 메시지 First trade를 저장할 Memo Program이에요. 모든 게 원자적이라 스왑, 수수료, 메시지가 다 같이 성공하거나 같이 실패해요.

완료! 거래 실행, 수수료 수집, 메시지 온체인. 전부 하나의 트랜잭션에서요."

## SCENE 3: Blockchain Verification (20 seconds)

### English
"Let's verify this on Solana Explorer. Here's our transaction. You can see all the instructions including the compute budget, token transfers, Raydium swap calls, and here's the Memo Program. That's my message stored permanently on chain."

### 한국어
"Solana Explorer에서 확인해볼게요. 여기 우리 트랜잭션이에요. 컴퓨트 예산, 토큰 전송, Raydium 스왑 호출 같은 모든 인스트럭션을 볼 수 있고, 여기 Memo Program이 있어요. 제 메시지가 체인에 영구적으로 저장됐어요."

## SCENE 4: OBS Integration (15 seconds)

### English
"For streamers, we built a popup URL you can add to OBS as a browser source. Copy the chatroom popup URL, add it to OBS, and all trades and messages from viewers show up live on your stream."

### 한국어
"스트리머들을 위해 OBS에 브라우저 소스로 추가할 수 있는 팝업 URL을 만들었어요. 채팅방 팝업 URL을 복사해서 OBS에 추가하면 시청자들의 모든 거래와 메시지가 방송에 실시간으로 나타나요."

## CLOSING (15 seconds)

### English
"That's it! We use Wallet Adapter for connections, Jupiter for optimal swap routing, and Memo Program for on chain messages. Everything happens in one atomic transaction. Thanks for watching!"

### 한국어
"이게 다예요! Wallet Adapter로 연결하고, Jupiter로 최적 스왑 경로를 찾고, Memo Program으로 온체인 메시지를 저장해요. 모든 게 하나의 원자적 트랜잭션에서 일어나요. 시청해주셔서 감사합니다!"

