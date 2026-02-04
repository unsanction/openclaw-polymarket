import { Type } from "@sinclair/typebox";
import { Side as ClobSide, AssetType } from "@polymarket/clob-client";
import { ClobClientWrapper } from "mcp-polymarket/client";

// ============================================================================
// Type Definitions
// ============================================================================

interface GammaMarket {
  conditionId: string;
  question: string;
  slug: string;
  volume: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  clobTokenIds?: string[];
  outcomes?: string[];
  outcomePrices?: string[];
}

interface RawOrderbookEntry {
  price: string;
  size: string;
}

interface RawOrderbook {
  bids?: RawOrderbookEntry[];
  asks?: RawOrderbookEntry[];
}

interface RawBalanceAllowance {
  balance?: string;
  allowance?: string;
}

interface RawOpenOrder {
  id: string;
  asset_id: string;
  side: string;
  price: string;
  original_size: string;
  size_matched: string;
  outcome?: string;
  market?: string;
}

interface RawTrade {
  id: string;
  asset_id: string;
  side: string;
  price: string;
  size: string;
  timestamp?: string;
  match_time?: string;
  status: string;
}

interface RawOrderResponse {
  orderID?: string;
  status?: string;
  errorMsg?: string;
}

interface RawMarketInfo {
  minimum_tick_size?: number;
  neg_risk?: boolean;
}

// ============================================================================
// Tool Result Helper
// ============================================================================

function toolResult(data: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function errorResult(message: string) {
  return toolResult({ error: message }, true);
}

// ============================================================================
// Market Tools
// ============================================================================

async function fetchGammaMarkets(
  client: ClobClientWrapper,
  limit: number,
  offset: number,
  search?: string
): Promise<GammaMarket[]> {
  const baseUrl = client.getGammaApiUrl();
  const params = new URLSearchParams({
    limit: (limit * 3).toString(), // Fetch more to filter closed ones
    offset: offset.toString(),
    closed: "false", // Only non-closed markets
  });

  if (search) {
    params.set("slug_contains", search.toLowerCase());
  }

  const url = `${baseUrl}/markets?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.statusText}`);
  }

  const data = (await response.json()) as GammaMarket[];
  if (!Array.isArray(data)) return [];

  // Filter for active, non-closed markets with token IDs
  const filtered = data.filter((m) => !m.closed && m.clobTokenIds);
  return filtered.slice(0, limit);
}

async function fetchGammaMarket(
  client: ClobClientWrapper,
  conditionId: string
): Promise<GammaMarket | null> {
  const baseUrl = client.getGammaApiUrl();
  const url = `${baseUrl}/markets/${conditionId}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch market: ${response.statusText}`);
  }

  return (await response.json()) as GammaMarket;
}

// Parse JSON string fields from Gamma API (they return stringified arrays)
function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (Array.isArray(value)) {
    return value as T;
  }
  return fallback;
}

function formatMarket(market: GammaMarket) {
  const tokens = [];
  const outcomes = parseJsonField<string[]>(market.outcomes, ["Yes", "No"]);
  const prices = parseJsonField<string[]>(market.outcomePrices, []);
  const tokenIds = parseJsonField<string[]>(market.clobTokenIds, []);

  for (let i = 0; i < outcomes.length; i++) {
    tokens.push({
      token_id: tokenIds[i] || "",
      outcome: outcomes[i],
      price: prices[i] ? parseFloat(prices[i]) : 0,
    });
  }

  return {
    condition_id: market.conditionId,
    question: market.question,
    tokens,
    volume: market.volume || "0",
    end_date: market.endDate || "",
    active: market.active,
    closed: market.closed,
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export function createPolymarketTools(client: ClobClientWrapper) {
  return [
    // ========================================================================
    // GET MARKETS
    // ========================================================================
    {
      name: "polymarket_get_markets",
      description: `List available prediction markets on Polymarket.

Returns market questions, current Yes/No prices, trading volume, and token IDs needed for trading.

**Example use cases:**
- "Show me markets about AI"
- "Find prediction markets about elections"
- "What markets are available on Polymarket?"

**Response includes:**
- condition_id: Unique market identifier
- question: The prediction question
- tokens: Array with token_id, outcome (Yes/No), and current price (0-1)
- volume: Total trading volume in USDC`,
      parameters: Type.Object({
        limit: Type.Optional(
          Type.Number({
            description: "Maximum number of markets to return (1-100, default: 10)",
            minimum: 1,
            maximum: 100,
          })
        ),
        offset: Type.Optional(
          Type.Number({
            description: "Number of markets to skip for pagination (default: 0)",
            minimum: 0,
          })
        ),
        search: Type.Optional(
          Type.String({
            description: "Search term to filter markets by question/slug",
          })
        ),
      }),

      async execute(_id: string, params: Record<string, unknown>) {
        try {
          await client.initialize();
          const limit = (params.limit as number) || 10;
          const offset = (params.offset as number) || 0;
          const search = params.search as string | undefined;

          const markets = await fetchGammaMarkets(client, limit, offset, search);
          const formatted = markets.map(formatMarket);

          return toolResult(formatted);
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      },
    },

    // ========================================================================
    // GET MARKET
    // ========================================================================
    {
      name: "polymarket_get_market",
      description: `Get detailed information about a specific prediction market.

Use this to get token IDs and current prices before placing orders.

**Parameters:**
- condition_id: The market's unique identifier (from polymarket_get_markets)

**Response includes:**
- Full market details including token_id for each outcome
- Current prices for Yes and No outcomes`,
      parameters: Type.Object({
        condition_id: Type.String({
          description: "The market's condition ID (unique identifier)",
        }),
      }),

      async execute(_id: string, params: Record<string, unknown>) {
        try {
          await client.initialize();
          const conditionId = params.condition_id as string;

          if (!conditionId) {
            return errorResult("condition_id is required");
          }

          const market = await fetchGammaMarket(client, conditionId);

          if (!market) {
            return errorResult(`Market not found: ${conditionId}`);
          }

          return toolResult(formatMarket(market));
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      },
    },

    // ========================================================================
    // GET ORDERBOOK
    // ========================================================================
    {
      name: "polymarket_get_orderbook",
      description: `Get the order book for a specific token showing current bids and asks.

Use this before placing orders to see market depth and best available prices.

**Parameters:**
- token_id: The token's unique identifier (from market's tokens array)

**Response includes:**
- bids: Buy orders sorted by price (highest first)
- asks: Sell orders sorted by price (lowest first)
- Each entry has price (0-1) and size (in shares)

**Trading tip:**
- To BUY immediately, use a price >= lowest ask
- To SELL immediately, use a price <= highest bid`,
      parameters: Type.Object({
        token_id: Type.String({
          description: "The token ID to get orderbook for",
        }),
      }),

      async execute(_id: string, params: Record<string, unknown>) {
        try {
          await client.initialize();
          const tokenId = params.token_id as string;

          if (!tokenId) {
            return errorResult("token_id is required");
          }

          const clobClient = client.getClient();
          const orderbook = (await clobClient.getOrderBook(tokenId)) as RawOrderbook;

          return toolResult({
            token_id: tokenId,
            bids: orderbook.bids || [],
            asks: orderbook.asks || [],
          });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      },
    },

    // ========================================================================
    // GET BALANCE
    // ========================================================================
    {
      name: "polymarket_get_balance",
      description: `Get the USDC balance and allowance for the configured wallet.

Use this to check available funds before placing orders.

**Response includes:**
- address: The wallet address (funder/proxy wallet)
- balance: Available USDC balance (in smallest units, divide by 1e6 for dollars)
- allowance: Approved spending allowance`,
      parameters: Type.Object({}),

      async execute(_id: string, _params: Record<string, unknown>) {
        try {
          await client.initialize();
          const clobClient = client.getClient();
          const funder = client.getFunder();

          const balanceData = (await clobClient.getBalanceAllowance({
            asset_type: AssetType.COLLATERAL,
          })) as RawBalanceAllowance;

          return toolResult({
            address: funder,
            balance: balanceData.balance || "0",
            allowance: balanceData.allowance || "0",
          });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      },
    },

    // ========================================================================
    // GET POSITIONS
    // ========================================================================
    {
      name: "polymarket_get_positions",
      description: `Get all open orders and positions for the configured wallet.

Use this to see current exposure and pending orders.

**Response includes:**
- positions: Grouped by token with size and price info
- open_orders: All pending orders with details`,
      parameters: Type.Object({}),

      async execute(_id: string, _params: Record<string, unknown>) {
        try {
          await client.initialize();
          const clobClient = client.getClient();

          const openOrders = (await clobClient.getOpenOrders()) as RawOpenOrder[];

          if (!openOrders || openOrders.length === 0) {
            return toolResult({ positions: [], open_orders: [] });
          }

          const positionMap = new Map<string, unknown>();
          for (const order of openOrders) {
            const tokenId = order.asset_id;
            if (!positionMap.has(tokenId)) {
              positionMap.set(tokenId, {
                token_id: tokenId,
                market: order.market || "Unknown",
                outcome: order.outcome || "Unknown",
                size: order.original_size,
                avg_price: order.price,
              });
            }
          }

          const formattedOrders = openOrders.map((o) => ({
            id: o.id,
            token_id: o.asset_id,
            side: o.side,
            price: o.price,
            size: o.original_size,
            filled: o.size_matched,
          }));

          return toolResult({
            positions: Array.from(positionMap.values()),
            open_orders: formattedOrders,
          });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      },
    },

    // ========================================================================
    // GET TRADES
    // ========================================================================
    {
      name: "polymarket_get_trades",
      description: `Get recent executed trades for the configured wallet.

Use this to see trade history and execution prices.

**Parameters:**
- limit: Maximum number of trades to return (default: 20)`,
      parameters: Type.Object({
        limit: Type.Optional(
          Type.Number({
            description: "Maximum number of trades to return (1-100, default: 20)",
            minimum: 1,
            maximum: 100,
          })
        ),
      }),

      async execute(_id: string, params: Record<string, unknown>) {
        try {
          await client.initialize();
          const limit = (params.limit as number) || 20;
          const clobClient = client.getClient();

          const allTrades = (await clobClient.getTrades({})) as RawTrade[];
          const trades = (allTrades || []).slice(0, limit);

          const formatted = trades.map((t) => ({
            id: t.id,
            token_id: t.asset_id,
            side: t.side,
            price: t.price,
            size: t.size,
            timestamp: t.timestamp || t.match_time || "",
            status: t.status,
          }));

          return toolResult(formatted);
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      },
    },

    // ========================================================================
    // PLACE ORDER
    // ========================================================================
    {
      name: "polymarket_place_order",
      description: `Place a limit order on Polymarket.

⚠️ CAUTION: This executes a REAL trade with REAL funds!

**Parameters:**
- token_id: The token to trade (from market's tokens array)
- side: "BUY" or "SELL"
- size: Number of shares (minimum 5)
- price: Price per share between 0 and 1 (exclusive)

**Examples:**
- BUY 10 shares of "Yes" at $0.60: side="BUY", size="10", price="0.60"
- SELL 5 shares at $0.75: side="SELL", size="5", price="0.75"

**Important:**
- Price represents probability (0.60 = 60% chance)
- For immediate fills, use price at or better than current market
- Minimum order size is 5 shares
- Orders may partially fill`,
      parameters: Type.Object({
        token_id: Type.String({
          description: "The token ID to trade",
        }),
        side: Type.Union([Type.Literal("BUY"), Type.Literal("SELL")], {
          description: 'Order side: "BUY" or "SELL"',
        }),
        size: Type.String({
          description: "Number of shares to trade (minimum 5)",
        }),
        price: Type.String({
          description: "Price per share (0 < price < 1)",
        }),
      }),

      async execute(_id: string, params: Record<string, unknown>) {
        try {
          await client.initialize();
          client.ensureWriteAccess();

          const tokenId = params.token_id as string;
          const side = params.side as "BUY" | "SELL";
          const size = parseFloat(params.size as string);
          const price = parseFloat(params.price as string);

          if (!tokenId) return errorResult("token_id is required");
          if (!side) return errorResult("side is required (BUY or SELL)");
          if (isNaN(size) || size < 5) return errorResult("size must be at least 5");
          if (isNaN(price) || price <= 0 || price >= 1) {
            return errorResult("price must be between 0 and 1 (exclusive)");
          }

          const clobClient = client.getClient();

          // Get market info
          let tickSize = 0.01;
          let negRisk = false;
          try {
            const marketInfo = (await clobClient.getMarket(tokenId)) as RawMarketInfo;
            tickSize = marketInfo.minimum_tick_size || 0.01;
            negRisk = marketInfo.neg_risk || false;
          } catch {
            // Use defaults
          }

          const orderArgs = {
            tokenID: tokenId,
            side: side === "BUY" ? ClobSide.BUY : ClobSide.SELL,
            size,
            price,
            feeRateBps: 0,
          };

          const signedOrder = await clobClient.createOrder(orderArgs);
          const response = (await clobClient.postOrder(signedOrder)) as RawOrderResponse;

          return toolResult({
            order_id: response.orderID || "",
            status: response.status || "unknown",
            message: response.errorMsg,
            order_details: {
              token_id: tokenId,
              side,
              size: size.toString(),
              price: price.toString(),
              tick_size: tickSize,
              neg_risk: negRisk,
            },
          });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      },
    },

    // ========================================================================
    // CANCEL ORDER
    // ========================================================================
    {
      name: "polymarket_cancel_order",
      description: `Cancel an existing order on Polymarket.

**Parameters:**
- order_id: The order ID to cancel (from polymarket_get_positions)

**Note:** Only open (unfilled) orders can be cancelled.`,
      parameters: Type.Object({
        order_id: Type.String({
          description: "The order ID to cancel",
        }),
      }),

      async execute(_id: string, params: Record<string, unknown>) {
        try {
          await client.initialize();
          client.ensureWriteAccess();

          const orderId = params.order_id as string;

          if (!orderId) {
            return errorResult("order_id is required");
          }

          const clobClient = client.getClient();
          const response = await clobClient.cancelOrder({ orderID: orderId });

          return toolResult({
            order_id: orderId,
            status: "cancelled",
            response,
          });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      },
    },
  ];
}
