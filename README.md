# Buyve - Don't Send Tips. Buy It. Feel the Vibe.

<div align="center">

**Reimagining the creator economy on Solana. A blockchain-powered platform that transforms how fans support content creators through tokenized engagement.**

[![Next.js](https://img.shields.io/badge/Next.js-15.3.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-14F195?style=for-the-badge&logo=solana)](https://solana.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Jupiter](https://img.shields.io/badge/Jupiter-DEX-00D4AA?style=for-the-badge)](https://jup.ag/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](LICENSE)

[Live Demo](https://buyve.app) • [Documentation](#usage-guide) • [Report Bug](#support)

</div>

---

## Overview

Buyve isn't about just giving tips anymore. We're revolutionizing the $100B global live streaming industry by replacing traditional tipping with on-chain token ownership. Streamers create their own coins, and fans buy them to share the vibe, trigger reactions, and drop messages.

Built on Solana with Jupiter DEX integration and real-time messaging, Buyve bridges the gap between the $13B fan economy and decentralized finance, creating a new paradigm where supporting your favorite creator means becoming a stakeholder in their success.

### The Vision: Internet Capital Market

Transform the traditional live streaming platforms (YouTube, Twitch, OnlyFans, Kick, Instagram Live, and more) by introducing a creator-owned token economy. Every message, every interaction, every moment of support becomes an on-chain asset that fans can own, trade, and cherish.

## How It Works

<div align="center">

### Three Simple Steps to Transform Creator Support

</div>

| Step | Action | Description |
|------|--------|-------------|
| **1️⃣ Create** | **Launch Your Token** | Streamers and content creators launch their own tokens using existing launchpads:<br>• [pump.fun](https://pump.fun) - Launch memecoins in seconds<br>• [bonk.fun](https://bonk.fun) - Create community tokens<br>• [studio.jup.ag](https://studio.jup.ag) - Jupiter Token Studio<br>• [believe.app](https://believe.app) - Professional token launches<br><br>*We don't offer coin creation because there are already plenty of great launchpads out there.* |
| **2️⃣ Add** | **Register Chat Room** | Register your token's chat room on Buyve:<br>• One chat box per token (first come, first served)<br>• Doesn't have to be added by the coin creator<br>• Perfect for Streamers, YouTubers, KOLs, and CTOs<br>• Embeddable chat widgets for live streams (coming soon) |
| **3️⃣ Buy** | **Token = Message Access** | Fans buy your token to participate:<br>• **It's no longer just about sending tips**<br>• Token ownership = Message access + Community membership<br>• Every interaction is recorded on-chain<br>• Fans become stakeholders in the creator's success |

## Key Features

### For Creators
- **Tokenized Fan Economy** - Monetize your community through token ownership
- **Real-Time Engagement** - Instant chat rooms tied to your token
- **On-Chain Interactions** - All messages and trades recorded permanently on Solana
- **Multiple Platform Support** - Works across YouTube, Twitch, Kick, and more
- **Customizable Chat Rooms** - Brand your space with token images and descriptions

### For Fans
- **Own What You Support** - Buy tokens instead of sending disposable tips
- **Trade & Speculate** - Token values fluctuate based on creator popularity
- **Jupiter DEX Integration** - Best prices across all Solana DEXs
- **Multi-Wallet Support** - Compatible with 8+ Solana wallets (Phantom, Solflare, Backpack, Ledger, etc.)
- **Real-Time Price Tracking** - Live token price updates with OHLC chart data
- **Customizable Trading** - Configure slippage tolerance, priority fees, and preset trade amounts

### Technical Excellence
- **Lightning-Fast Trading** - Powered by Solana's high-performance blockchain
- **Secure Authentication** - Wallet-based JWT authentication with signature verification
- **Real-Time Messaging** - Instant message delivery using Supabase Realtime
- **Transaction Memos** - Automated on-chain message recording with each trade
- **Rate Limited APIs** - Enterprise-grade protection and performance
- **RPC Proxy** - Secure Solana RPC access through internal proxy

## Market Opportunity

<div align="center">

### The Numbers Don't Lie

| Metric | Value |
|--------|-------|
| 🌍 **Global Live Streaming Market** | $100 Billion |
| 📹 **Global Live Streamers** | 10 Million+ |
| 💰 **Fan Economy** | $13 Billion |

</div>

### Target Platforms

<div align="center">

We're not building just another live streaming platform. **We're building the infrastructure layer.**

| Category | Platforms |
|----------|-----------|
| 🎮 **Gaming Streaming** | YouTube Live, Twitch, Kick |
| 🌏 **Regional Platforms** | Bilibili, AfreecaTV, BIGO Live |
| 💎 **Creator Subscriptions** | OnlyFans, Fansly, Fanvue |
| 🎨 **Creator Support** | Patreon, Ko-fi, Buy Me a Coffee |
| 📱 **Social Media Live** | Instagram Live, Facebook Live, TikTok Live |

</div>

> *"We're not building just another live streaming messaging platform. Imagine streamers interacting with the 'physical things' on-chain. Big things are coming. Soon."*

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

## Usage Guide

### For Content Creators

#### Step 1: Launch Your Token
1. Choose your preferred launchpad (pump.fun, bonk.fun, studio.jup.ag, or believe.app)
2. Create your creator token with your brand identity
3. Set initial supply and distribution

#### Step 2: Register Your Chat Room on Buyve
1. Visit [Buyve](https://buyve.fun) and connect your wallet
2. Click the "+" button to create a new chat room
3. Enter your token's contract address
4. Customize with name, description, and branding
5. Your fans can now buy your token to message and engage

#### Step 3: Embed Chat Widget (Coming Soon)
- Integrate Buyve chat into your live streams
- Works across YouTube, Twitch, and other platforms
- Fans interact directly through the embedded widget

### For Fans & Supporters

#### Connect Your Wallet
1. Click "Connect Wallet" in the top navigation
2. Select your preferred Solana wallet (Phantom, Solflare, etc.)
3. Approve the connection and sign the authentication message

#### Buy Tokens & Join Communities
1. Browse available creator chat rooms in the left sidebar
2. Search for your favorite creators using the search bar
3. Click on a chat room to view token info and price chart
4. Open the trade panel on the right side
5. Choose "Buy" mode and enter the amount (or use presets)
6. Adjust slippage tolerance if needed
7. Click "Swap" and approve the transaction in your wallet

#### Send Messages & Engage
1. Once you own tokens, you can participate in the chat
2. Type your message with the trade amount
3. Your message is recorded on-chain with the transaction
4. Watch your tokens appreciate as the creator gains popularity

#### Manage Your Holdings
1. View your token balance in real-time
2. Check price charts with OHLC data
3. Sell tokens anytime using the "Sell" mode
4. Customize trading settings (slippage, priority fees, presets)

### Customize Your Profile
1. Click your wallet address in the top navigation
2. Select "Profile Settings"
3. Upload an avatar, set a nickname, and add a bio
4. Save your changes to personalize your presence

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

- **Message Caching:** Maximum 500 messages per room with 24-hour retention
- **Token Metadata Caching:** Multi-layer cache (memory + database)
- **Price History Aggregation:** 1-minute interval data
- **Connection Pooling:** Reusable Solana connection instances
- **Image Optimization:** Proxy service with fallback mechanisms
- **Real-time Subscriptions:** Efficient Supabase channel management

## License

This project is private and proprietary. All rights reserved.

## Support

## Why Buyve?

<div align="center">

### Traditional Tips vs. Buyve Tokens

</div>

| Feature | 💸 Traditional Tips | 🪙 Buyve Tokens |
|---------|-------------------|----------------|
| **Value Retention** | ❌ Disposable - gone after sending | ✅ Owned asset with appreciation potential |
| **Alignment** | ❌ No benefit from creator success | ✅ Token value tied to creator popularity |
| **Platform Fees** | ❌ 30-50% platform cut | ✅ 0.69% blockchain fee |
| **Ownership** | ❌ No stake in community | ✅ Stakeholder & community member |
| **Permanence** | ❌ Ephemeral transaction | ✅ On-chain forever on Solana |
| **Tradability** | ❌ Cannot resell or trade | ✅ Trade anytime on DEXs |
| **Speculation** | ❌ No investment upside | ✅ Potential for profit |

### Competitive Advantages

<table>
<tr>
<td width="50%">

**🏗️ Infrastructure Play**
- Not competing with streaming platforms
- Enhancing existing ecosystems
- Platform-agnostic integration

</td>
<td width="50%">

**📈 Network Effects**
- More creators = More value
- More fans = Higher liquidity
- Self-reinforcing growth loop

</td>
</tr>
<tr>
<td>

**💹 Speculation Layer**
- Trade creator tokens like stocks
- Price discovery through markets
- Fan investing in creator success

</td>
<td>

**🔗 On-Chain Social Graph**
- Permanent interaction records
- Verifiable community membership
- Transparent transaction history

</td>
</tr>
<tr>
<td colspan="2" align="center">

**🌐 Multi-Platform Compatibility**
Works across YouTube, Twitch, OnlyFans, Kick, and dozens more

</td>
</tr>
</table>

*✅ Completed | 🔄 In Progress | ⏳ Planned*

## Acknowledgments

Built on the shoulders of giants:
- [Solana](https://solana.com/) - The world's fastest blockchain
- [Jupiter](https://jup.ag/) - Best DEX aggregator on Solana
- [Supabase](https://supabase.com/) - Open-source Firebase alternative
- [Next.js](https://nextjs.org/) - The React framework for production
- [Metaplex](https://www.metaplex.com/) - NFT and token metadata standard
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful component library

Inspired by the creator economy revolution and built with passion for the Solana ecosystem.

---

<div align="center">

## Join the Revolution

### **Buy the Buyve. Keep the Buyve.**

Transform how you support creators. Own the moment. Share the vibe.

<br>

[![Start Trading](https://img.shields.io/badge/🚀_Start_Trading-Visit_Buyve-blueviolet?style=for-the-badge&labelColor=000000)](https://buyve.app/trade)
[![Create Chat Room](https://img.shields.io/badge/💬_Create_Chat-For_Creators-success?style=for-the-badge&labelColor=000000)](https://buyve.app/trade)

<br>

**The future of creator support is on-chain.**

*Built with ❤️ for the Solana ecosystem and the creator economy revolution.*

<br>

---

**Copyright © 2025 Buyve. All rights reserved.**

</div>
