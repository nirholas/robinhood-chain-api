---
name: hood-api
description: Run and query the hood-api market-data service for Robinhood Chain (chain ID 4663). Use when you need Stock Token prices against Chainlink, memecoin launchpad data, portfolios or cross-venue spreads, or when you need to run or test the x402-metered endpoints.
---

# hood-api

hood-api is a Hono server (Node 20+) that serves Robinhood Chain market data over HTTP. There is no shared hosted instance documented in the repo, so run your own from a clone. The free tier needs no keys.

## Run it

```bash
git clone https://github.com/nirholas/robinhood-chain-api
cd robinhood-chain-api
npm install
cp .env.example .env
npm run dev        # tsx watch, listens on PORT (default 8787)
```

`hoodchain` is pinned to the checked-in tarball `hoodchain-0.1.0.tgz`, which `npm install` resolves locally. Other scripts: `npm run build`, `npm test`, `npm run openapi`, `npm run smoke`.

## Free endpoints (no key)

All under `/v1`, JSON, with `asOf` and `source` fields. Errors are `{ error, hint, docs }`.

| Endpoint | Query | Returns |
| --- | --- | --- |
| `GET /v1/health` | none | Liveness, RPC reachability, chain ID, block height, whether payments are enabled |
| `GET /v1/chain` | none | Block height, gas, TVL, ETH price, tx counts |
| `GET /v1/stocks` | none | All Stock Tokens: Chainlink price, DEX price, premium/discount, `uiMultiplier`, liquidity |
| `GET /v1/stocks/{symbol}` | `interval`: 5m, 15m, 1h, 4h, 1d | One token in depth with candles |
| `GET /v1/coins` | `limit` 1-60 | Memecoins with launchpad state, price, liquidity |
| `GET /v1/coins/{address}` | none | One coin's detail |
| `GET /v1/launches` | `launchpad`: noxa or odyssey; `lookback`: 15m, 1h, 6h, 24h; `limit` 1-200 | Recent launchpad activity |

```bash
curl http://localhost:8787/v1/stocks/TSLA
curl "http://localhost:8787/v1/launches?launchpad=noxa&lookback=1h"
```

## Paid endpoints (x402)

These return HTTP 402 with a payment challenge until paid: `GET /v1/portfolio/{address}`, `GET /v1/stocks/{symbol}/history` (`interval`, `lookback`: 1h, 6h, 24h, 7d, 30d), `GET /v1/equities` (`limit` 1-30), `GET /v1/equities/{symbol}`, and `GET /v1/firehose`. The firehose call returns a session token and a `wsUrl` for `wss://<host>/v1/ws?token=...&channels=...`, valid about 10 minutes. Channels: `firehose`, `launches`, `trades`, `ticks`.

Paying moves real funds. Before sending a payment, show the user the endpoint, price, network and payer wallet, and wait for an explicit yes. The 402 challenge itself is free to read.

## Environment variables

All optional. `PORT`, `PUBLIC_BASE_URL`, `ALCHEMY_KEY`, `HOOD_RPC_URL`, `COINGECKO_API_KEY`. To enable paid routes set `X402_PAY_TO`; also `X402_NETWORK` (`base` or `base-sepolia`, default `base-sepolia`), `X402_FACILITATOR_URL`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` (Base mainnet only), and `FIREHOSE_SESSION_SECRET`. Without `X402_PAY_TO`, paid routes return 503 `payments_not_configured`.

## Reference

`openapi.json` in the repo root documents every route and schema. Regenerate it with `npm run openapi`.
