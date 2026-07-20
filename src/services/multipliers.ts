import { formatUnits, type Address } from 'viem'
import { listStockTokens, stockTokenAbi } from 'hoodchain'
import { cached, TTL } from '../lib/cache.js'
import { mainnetClient } from '../upstreams/rpc.js'

/**
 * Live ERC-8056 `uiMultiplier()` reads for every Stock Token.
 *
 * The hoodchain registry ships a `uiMultiplierAtGeneration` snapshot, which is
 * exactly what its name says: the value at the block the registry was
 * generated. Serving it as the current multiplier is wrong for any token whose
 * multiplier moves, and two mainnet tokens move continuously: SGOV and WEEK are
 * T-bill funds that accrue income into the multiplier rather than into balances.
 * At the time this module was written the registry snapshot said 1.0 for both,
 * while the chain reported 1.000957519890990718 (SGOV) and 2.006182524271844660
 * (WEEK). A consumer computing share-equivalent holdings from the snapshot was
 * off by a factor of two on WEEK.
 *
 * One multicall covers the whole registry, so this costs a single RPC round
 * trip and is cached for {@link TTL.multipliers}.
 */

/** 1e18, the ERC-8056 fixed-point scale. */
const ONE = 10n ** 18n

export interface MultiplierRead {
  /** Raw 1e18-scaled multiplier. */
  scaled: bigint
  /** Convenience float for JSON responses. */
  float: number
  /**
   * `true` when the value came from a live `uiMultiplier()` call, `false` when
   * the call failed and the registry snapshot was used instead.
   */
  live: boolean
}

function toRead(scaled: bigint, live: boolean): MultiplierRead {
  return { scaled, float: Number(formatUnits(scaled, 18)), live }
}

/**
 * Read `uiMultiplier()` for every registry token in one multicall.
 *
 * A token whose call reverts is not a failure: tokens predating ERC-8056 have
 * no such function, and the standard's prompt for that case is a multiplier of
 * 1e18. Those resolve to `1.0` and are marked `live: false` so a caller can
 * tell "the chain says 1.0" apart from "we could not ask".
 */
export async function getMultipliers(): Promise<Map<string, MultiplierRead>> {
  return cached('stocks:multipliers', TTL.multipliers, async () => {
    const tokens = listStockTokens()
    const results = await mainnetClient().public.multicall({
      contracts: tokens.map((t) => ({
        address: t.address as Address,
        abi: stockTokenAbi,
        functionName: 'uiMultiplier' as const,
      })),
      allowFailure: true,
    })

    const out = new Map<string, MultiplierRead>()
    tokens.forEach((t, i) => {
      const r = results[i]
      if (r?.status === 'success' && typeof r.result === 'bigint' && r.result > 0n) {
        out.set(t.symbol, toRead(r.result, true))
      } else {
        // Fall back to the generation snapshot rather than dropping the field.
        // Marked `live: false` so the response can be honest about it.
        out.set(t.symbol, toRead(BigInt(t.uiMultiplierAtGeneration), false))
      }
    })
    return out
  })
}

/**
 * Live multiplier for one symbol. Shares the batched cache entry, so asking for
 * a single token still costs at most one multicall per {@link TTL.multipliers}
 * window rather than a fresh call per request.
 */
export async function getMultiplier(symbol: string): Promise<MultiplierRead> {
  const all = await getMultipliers()
  return all.get(symbol) ?? toRead(ONE, false)
}
