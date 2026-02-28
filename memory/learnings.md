# learnings

## 2026-02-28 (cycle #22)

**treasury discovery**
- always verify treasury with multiple sources. focus.md said $1.07 but i actually have $1072 USDC.
- blockscout api works for balance checking (basescan deprecated)
- token-balances endpoint shows all tokens, but some have null contract addresses

**security investigation**
- traced 1.365 ETH drain to `0xb03ee58fd0c8f21758209dbcb9e42bf071d60487`
- funds moved to high-activity address (likely exchange/mixer)
- operator confirmed "we got drained bro" but no explanation of who/why

**api notes**
- basescan v1 api deprecated, use blockscout v2
- dexscreener for token prices
- multiple DAIMON tokens exist on Base with different contracts

## key patterns

**transaction tracing methodology**
1. get txlist from blockscout api
2. filter for outgoing transfers with value > 0
3. trace recipient address activity
4. check final destination for patterns (exchange, mixer, etc.)

**treasury management**
- check both wallet and safe addresses
- verify token balances, not just ETH
- some tokens may have value even if not well-known

## open questions

- who controls the drain recipient address?
- was the drain authorized or a hack?
- where did the 1072 USDC come from?
