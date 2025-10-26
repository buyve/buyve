# Buyve - Solana Trading & Social Platform

A real-time decentralized trading platform that combines token trading with social chat rooms on the Solana blockchain.

## Overview

Buyve is a Next.js-based web application that enables users to trade Solana tokens while participating in token-specific chat rooms. Built with Jupiter DEX aggregation for optimal trade execution and Supabase for real-time messaging, Buyve creates a seamless trading experience where community discussion and trading happen in one place.

## Key Features

### Trading
- **Jupiter DEX Integration** - Access the best prices across Solana DEXs through Jupiter aggregation
- **Multi-Wallet Support** - Compatible with 8+ Solana wallets (Phantom, Solflare, Backpack, Ledger, etc.)
- **Customizable Trading Settings** - Configure slippage tolerance, priority fees, and preset trade amounts
- **Real-Time Price Tracking** - Live token price updates with OHLC chart data
- **Transaction Memos** - Automated on-chain message recording with each trade

### Social
- **Token Chat Rooms** - Create and join chat rooms for specific tokens
- **Real-Time Messaging** - Instant message delivery using Supabase Realtime
- **User Profiles** - Customizable profiles with avatars, nicknames, and bios
- **Trade Announcements** - Automatic trade notifications in chat rooms
- **Message History** - Persistent message storage with 24-hour retention

### Security
- **Wallet Authentication** - JWT-based authentication with signature verification
- **Rate Limiting** - API protection with configurable rate limits
- **RPC Proxy** - Secure Solana RPC access through internal proxy
- **Transaction Simulation** - Pre-execution validation for safer trading

## Tech Stack

### Frontend
- **Framework:** Next.js 15.3.2 (App Router with Turbopack)
- **Language:** TypeScript 5
- **UI Library:** React 19 with shadcn/ui components
- **Styling:** TailwindCSS 4
- **State Management:** React Context API
- **Charts:** Recharts with custom OHLC displays
- **Animations:** Framer Motion

### Blockchain
- **Network:** Solana Mainnet Beta
- **Web3 SDK:** @solana/web3.js v1.98
- **DEX Aggregator:** Jupiter API
- **Token Metadata:** Metaplex MPL Token Metadata
- **Wallet Adapters:** @solana/wallet-adapter-react with 8 wallet integrations

### Backend
- **Database:** PostgreSQL via Supabase
- **Real-time:** Supabase Realtime subscriptions
- **Authentication:** JWT with wallet signature verification
- **API Routes:** Next.js API routes with middleware

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- A Solana RPC endpoint (e.g., Helius, QuickNode, or public RPC)
- A Supabase project with PostgreSQL database
- JWT secret for token signing

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd buyve
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Solana Configuration
NEXT_PUBLIC_RPC_URL=your_solana_rpc_endpoint
NEXT_PUBLIC_SOLANA_NETWORK=mainnet
NEXT_PUBLIC_MEMO_PROGRAM_ID=MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr

# Authentication
JWT_SECRET=your_jwt_secret_key

# Optional
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

4. Set up the database:

Run the SQL migrations in your Supabase project to create the required tables:

```sql
-- Create chat_rooms table
CREATE TABLE chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  token_address TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL,
  member_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_cache table
CREATE TABLE message_cache (
  signature TEXT PRIMARY KEY,
  token_address TEXT NOT NULL,
  sender_wallet TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('BUY', 'SELL', 'CHAT')),
  content TEXT,
  quantity DOUBLE PRECISION,
  price DOUBLE PRECISION,
  block_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create token_price_history table
CREATE TABLE token_price_history (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  open_price DOUBLE PRECISION,
  high_price DOUBLE PRECISION,
  low_price DOUBLE PRECISION,
  close_price DOUBLE PRECISION,
  volume DOUBLE PRECISION DEFAULT 0,
  timestamp_1min TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table
CREATE TABLE profiles (
  wallet_address TEXT PRIMARY KEY,
  nickname TEXT,
  avatar TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trading_settings table
CREATE TABLE trading_settings (
  wallet_address TEXT PRIMARY KEY,
  buy_presets DOUBLE PRECISION[] DEFAULT ARRAY[0.1, 0.5, 1.0, 5.0],
  sell_presets DOUBLE PRECISION[] DEFAULT ARRAY[25, 50, 75, 100],
  slippage TEXT DEFAULT '20',
  priority_fee TEXT DEFAULT '0.001',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_message_cache_token ON message_cache(token_address);
CREATE INDEX idx_message_cache_block_time ON message_cache(block_time DESC);
CREATE INDEX idx_token_price_history_token ON token_price_history(token_address);
CREATE INDEX idx_token_price_history_timestamp ON token_price_history(timestamp_1min DESC);
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
buyve/
├── app/                        # Next.js App Router
│   ├── api/                   # API routes
│   │   ├── auth/             # Authentication endpoints
│   │   ├── chatrooms/        # Chat room management
│   │   ├── messages/         # Message handling
│   │   ├── profiles/         # User profiles
│   │   ├── trading-settings/ # Trade settings
│   │   └── price-*/          # Price data endpoints
│   ├── trade/                # Main trading page
│   └── layout.tsx            # Root layout with providers
├── components/                # React components
│   ├── layout/               # Layout components
│   │   ├── ChatArea.tsx     # Message display area
│   │   ├── ChatInput.tsx    # Message input with trade info
│   │   ├── Navbar.tsx       # Sidebar navigation
│   │   └── TradeSettingsPanel.tsx
│   ├── ui/                   # shadcn/ui components
│   └── chart/                # Price chart components
├── contexts/                  # React Context providers
│   ├── WalletContext.tsx    # Wallet state
│   └── TradeSettingsContext.tsx
├── hooks/                     # Custom React hooks
│   ├── useSwap.ts           # Swap execution
│   ├── useTrade.ts          # Trade management
│   ├── useChat.ts           # Chat room logic
│   └── useChatMessages.ts   # Message real-time subscriptions
├── lib/                       # Core business logic
│   ├── solana.ts            # Solana connection
│   ├── jupiter.ts           # Jupiter DEX integration
│   ├── supabase.ts          # Supabase client
│   ├── auth.ts              # Authentication
│   ├── tokenMetadata.ts     # Token metadata fetching
│   └── tokenPriceService.ts # Price tracking
├── providers/                 # Provider components
│   └── WalletProvider.tsx   # Solana wallet setup
└── types/                     # TypeScript definitions
    ├── index.ts             # Core types
    └── window.d.ts          # Window extensions
```

## Usage

### Connect Your Wallet

1. Click "Connect Wallet" in the top navigation
2. Select your preferred Solana wallet from the list
3. Approve the connection request in your wallet
4. Sign the authentication message to verify ownership

### Join a Chat Room

1. Browse available token chat rooms in the left sidebar
2. Search for specific tokens using the search bar
3. Click on a chat room to join
4. View real-time messages and trade activity

### Trade Tokens

1. Select a token chat room
2. Open the trade panel on the right side
3. Choose "Buy" or "Sell" mode
4. Enter the amount or select a preset
5. Adjust slippage tolerance and priority fee if needed
6. Review the quote and estimated price
7. Click "Swap" and approve the transaction in your wallet

### Create a New Chat Room

1. Click the "+" button in the sidebar
2. Enter the token's contract address
3. Provide a room name and description (optional)
4. Click "Create" to establish the room

### Customize Your Profile

1. Click your wallet address in the top navigation
2. Select "Profile Settings"
3. Upload an avatar, set a nickname, and add a bio
4. Save your changes

## API Routes

### Authentication
- `POST /api/auth/wallet` - Authenticate with wallet signature
- `POST /api/auth/verify` - Verify JWT token

### Chat Rooms
- `GET /api/chatrooms` - List all chat rooms
- `POST /api/chatrooms` - Create a new chat room
- `GET /api/chatrooms/check` - Check if room exists

### Messages
- `POST /api/messages` - Save a new message
- Real-time subscriptions via Supabase Realtime

### Trading
- `GET /api/price-realtime` - Get real-time token prices
- `GET /api/token-metadata` - Fetch token metadata
- `GET /api/chart` - Get price chart data
- `POST /api/trading-settings` - Save/load trading settings

### Infrastructure
- `POST /api/solana-rpc` - Solana RPC proxy
- `GET /api/rpc-stats` - RPC performance metrics
- `GET /api/image-proxy` - Image proxy service

## Configuration

### Trading Settings

Customize your trading experience in the Trade Settings Panel:

- **Slippage Tolerance:** 5-50 basis points (default: 20 bps)
- **Priority Fee:** Auto, Low, Medium, High, or Very High (default: 0.001 SOL)
- **Buy Presets:** Quick SOL amounts for buying (default: 0.1, 0.5, 1.0, 5.0)
- **Sell Presets:** Quick percentages for selling (default: 25%, 50%, 75%, 100%)

### Rate Limiting

Adjust rate limits in `middleware.ts`:

```typescript
const RATE_LIMIT_GENERAL = 100;    // requests per minute
const RATE_LIMIT_PRICE = 60;       // price update requests per minute
```

### Message Retention

Configure message retention in chat settings:

```typescript
const MAX_MESSAGES_PER_ROOM = 500;
const MESSAGE_RETENTION_HOURS = 24;
```

## Development

### Running Tests

```bash
npm run lint        # Run ESLint
npm run build       # Test production build
```

### Building for Production

```bash
npm run build
npm run start
```

### Environment Modes

- **Development:** `npm run dev` - Hot reload with Turbopack
- **Production:** `npm run build && npm run start` - Optimized build
- **Popup Mode:** Add `?popup=true` query parameter for embedded chat-only view

## Performance Optimization

- **Message Caching:** Maximum 500 messages per room with 24-hour retention
- **Token Metadata Caching:** Multi-layer cache (memory + database)
- **Price History Aggregation:** 1-minute interval OHLC data
- **Connection Pooling:** Reusable Solana connection instances
- **Image Optimization:** Proxy service with fallback mechanisms
- **Real-time Subscriptions:** Efficient Supabase channel management

## Security Considerations

1. **Never commit `.env` files** - Use `.env.local` for local development
2. **Protect JWT secrets** - Keep `JWT_SECRET` secure and rotate regularly
3. **Use secure RPCs** - Prefer authenticated RPC endpoints over public ones
4. **Validate transactions** - Always simulate transactions before execution
5. **Rate limit APIs** - Implement and monitor rate limits on all endpoints
6. **Verify signatures** - Validate wallet signatures for authentication

## Troubleshooting

### Wallet Connection Issues
- Ensure your wallet extension is installed and unlocked
- Clear browser cache and try reconnecting
- Check that you're on the correct Solana network (Mainnet)

### Transaction Failures
- Increase slippage tolerance for volatile tokens
- Raise priority fee during network congestion
- Verify sufficient SOL balance for transaction fees

### Price Data Not Loading
- Check RPC endpoint connectivity in `.env.local`
- Verify Supabase connection and API keys
- Monitor RPC stats at `/api/rpc-stats`

### Real-time Messages Not Appearing
- Confirm Supabase Realtime is enabled in your project
- Check browser console for WebSocket connection errors
- Verify message_cache table subscriptions are active

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary. All rights reserved.

## Support

For questions, issues, or feature requests, please:
- Open an issue on GitHub
- Contact the development team
- Check the documentation in `/docs` (if available)

## Acknowledgments

- [Solana](https://solana.com/) - High-performance blockchain
- [Jupiter](https://jup.ag/) - DEX aggregation protocol
- [Supabase](https://supabase.com/) - Backend infrastructure
- [Next.js](https://nextjs.org/) - React framework
- [Metaplex](https://www.metaplex.com/) - NFT and token metadata standard
- [shadcn/ui](https://ui.shadcn.com/) - UI component library

---

Built with passion for the Solana ecosystem.
