# @openclaw/polymarket

OpenClaw plugin for trading on [Polymarket](https://polymarket.com) prediction markets.

## Features

- **Browse Markets**: Search and list active prediction markets
- **View Orderbooks**: See current bids/asks and market depth
- **Check Balance**: View wallet USDC balance and allowances
- **Track Positions**: Monitor open orders and positions
- **Place Orders**: Execute limit orders (BUY/SELL)
- **Cancel Orders**: Cancel pending orders

## Installation

### From local path

```bash
cd /path/to/openclaw-polymarket
npm install
npm run build
openclaw plugins install -l .
```

### From npm (when published)

```bash
openclaw plugins install @openclaw/polymarket
```

## Configuration

### Option 1: OpenClaw config file

Add to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "polymarket": {
        "enabled": true,
        "config": {
          "privateKey": "0x...",
          "funder": "0x...",
          "readonly": false
        }
      }
    }
  }
}
```

Or use CLI:

```bash
openclaw config set plugins.entries.polymarket.config.privateKey "0x..."
openclaw config set plugins.entries.polymarket.config.funder "0x..."
```

### Option 2: Environment variables

```bash
export POLYMARKET_PRIVATE_KEY="0x..."
export POLYMARKET_FUNDER="0x..."           # Optional
export POLYMARKET_READONLY="false"         # Optional
```

### Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `privateKey` | Yes | Your wallet private key for signing transactions |
| `funder` | No | Polymarket proxy wallet address. If not set, derived from privateKey |
| `apiKey` | No | API key (auto-derived from privateKey if not set) |
| `apiSecret` | No | API secret (auto-derived from privateKey if not set) |
| `passphrase` | No | API passphrase (auto-derived from privateKey if not set) |
| `chainId` | No | Chain ID (default: 137 for Polygon) |
| `readonly` | No | Disable trading tools (default: false) |

### Finding Your Funder Address

Your Polymarket "funder" address is your proxy wallet - the address shown on polymarket.com when you're logged in. If you've deposited funds through Polymarket's UI, they're held in this proxy wallet.

- If `funder` equals your wallet address: Direct EOA mode
- If `funder` differs: Proxy wallet mode (most common)

## Available Tools

### Read-Only Tools

| Tool | Description |
|------|-------------|
| `polymarket_get_markets` | List active prediction markets |
| `polymarket_get_market` | Get details for a specific market |
| `polymarket_get_orderbook` | View order book for a token |
| `polymarket_get_balance` | Check wallet USDC balance |
| `polymarket_get_positions` | View open orders and positions |
| `polymarket_get_trades` | Get recent trade history |

### Trading Tools

| Tool | Description |
|------|-------------|
| `polymarket_place_order` | Place a limit order (BUY/SELL) |
| `polymarket_cancel_order` | Cancel an open order |

⚠️ **Trading tools execute real trades with real funds!**

## Usage Examples

### Find and analyze a market

```
User: "Find markets about Trump"

Agent uses: polymarket_get_markets(search="trump")
→ Returns list of markets with current prices

Agent uses: polymarket_get_orderbook(token_id="...")
→ Shows bid/ask spread and liquidity
```

### Place a trade

```
User: "Buy 10 shares of YES at $0.50"

Agent uses: polymarket_get_balance()
→ Confirms sufficient funds

Agent uses: polymarket_place_order(
  token_id="...",
  side="BUY",
  size="10",
  price="0.50"
)
→ Order placed!
```

### Check and close position

```
User: "Show my positions and sell any profitable ones"

Agent uses: polymarket_get_positions()
→ Shows open orders

Agent uses: polymarket_get_orderbook(token_id="...")
→ Checks current bid price

Agent uses: polymarket_place_order(
  token_id="...",
  side="SELL",
  size="10",
  price="0.85"
)
→ Position closed at profit
```

## Understanding Prices

- Prices represent probabilities (0 to 1)
- Price of 0.60 = 60% implied probability
- YES + NO prices sum to ~1.00
- Spread = Best Ask - Best Bid

## Safety Notes

1. **Start with readonly mode** to explore without risk
2. **Minimum order size is 5 shares**
3. **Orders may partially fill** - check positions after trading
4. **Consider the spread** - immediate round-trip will lose the spread

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Clean build
npm run clean
```

## Dependencies

This plugin uses [@c0pilot/mcp-polymarket](https://www.npmjs.com/package/@c0pilot/mcp-polymarket) for the core Polymarket CLOB client functionality.

## License

MIT
