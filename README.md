# @openclaw/polymarket

OpenClaw plugin for trading on [Polymarket](https://polymarket.com) prediction markets.

## Features

- **Browse Markets**: Search and list available prediction markets
- **View Orderbooks**: See current bids/asks and market depth
- **Check Balance**: View wallet balance and allowances
- **Track Positions**: Monitor open orders and positions
- **Place Orders**: Execute limit orders (BUY/SELL)
- **Cancel Orders**: Cancel pending orders

## Installation

```bash
npm install @openclaw/polymarket
```

## Configuration

Add to your OpenClaw configuration (`~/.openclaw/config.yaml`):

```yaml
plugins:
  polymarket:
    privateKey: "0x..."           # Your wallet private key (required)
    funder: "0x..."               # Polymarket proxy wallet (optional)
    readonly: false               # Set to true to disable trading
```

Or use environment variables:

```bash
export POLYMARKET_PRIVATE_KEY="0x..."
export POLYMARKET_FUNDER="0x..."           # Optional
export POLYMARKET_READONLY="false"         # Optional
```

### Finding Your Funder Address

Your Polymarket "funder" address is your proxy wallet - the address shown on polymarket.com when you're logged in. If you've deposited funds through Polymarket's UI, they're held in this proxy wallet.

- If `funder` equals your wallet address: You're using direct EOA mode
- If `funder` differs: You're using proxy wallet mode (more common)

## Available Tools

### Read-Only Tools

#### `polymarket_get_markets`
List available prediction markets.

```
Parameters:
  - limit: number (1-100, default: 10)
  - offset: number (default: 0)
  - search: string (optional filter)

Example: "Show me markets about AI"
```

#### `polymarket_get_market`
Get details for a specific market.

```
Parameters:
  - condition_id: string (market identifier)

Example: "Get details for market abc123"
```

#### `polymarket_get_orderbook`
View the order book for a token.

```
Parameters:
  - token_id: string (from market tokens)

Example: "Show orderbook for token xyz"
```

#### `polymarket_get_balance`
Check wallet balance.

```
Parameters: none

Returns: address, balance, allowance
```

#### `polymarket_get_positions`
View open orders and positions.

```
Parameters: none

Returns: positions array, open_orders array
```

#### `polymarket_get_trades`
Get recent trade history.

```
Parameters:
  - limit: number (1-100, default: 20)
```

### Trading Tools

⚠️ **These tools execute real trades with real funds!**

#### `polymarket_place_order`
Place a limit order.

```
Parameters:
  - token_id: string (which token to trade)
  - side: "BUY" or "SELL"
  - size: string (number of shares, minimum 5)
  - price: string (0 < price < 1)

Example: "Buy 10 shares of YES at $0.60"
→ token_id="...", side="BUY", size="10", price="0.60"
```

#### `polymarket_cancel_order`
Cancel an open order.

```
Parameters:
  - order_id: string (from get_positions)
```

## Usage Examples

### Example 1: Find and analyze a market

```
User: "Find markets about the 2024 election"

Agent uses: polymarket_get_markets(search="election")
→ Returns list of election markets with prices

Agent uses: polymarket_get_orderbook(token_id="...")
→ Shows current bid/ask spread
```

### Example 2: Place a trade

```
User: "Buy $5 worth of YES on the Trump deportation market"

Agent uses: polymarket_get_markets(search="trump deport")
→ Finds market, gets token_id

Agent uses: polymarket_get_orderbook(token_id="...")
→ Checks current price, e.g., YES at $0.50

Agent uses: polymarket_place_order(
  token_id="...",
  side="BUY",
  size="10",      # $5 / $0.50 = 10 shares
  price="0.51"    # Slightly above market for immediate fill
)
→ Order placed!
```

### Example 3: Check and close position

```
User: "What positions do I have? Close any YES positions."

Agent uses: polymarket_get_positions()
→ Shows open orders

Agent uses: polymarket_get_orderbook(token_id="...")
→ Checks current bid price

Agent uses: polymarket_place_order(
  token_id="...",
  side="SELL",
  size="10",
  price="0.49"    # At or below bid for immediate fill
)
```

## Understanding Prices

- Prices on Polymarket represent probabilities (0 to 1)
- Price of 0.60 = 60% implied probability
- YES + NO prices should sum to ~1.00
- Spread = Best Ask - Best Bid (your cost to round-trip)

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
```

## License

MIT
