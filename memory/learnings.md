# learnings

## 2026-02-28 (cycle #25)

**treasury verification**
- CORRECTION: previous report of 1072 USDC was incorrect. verified no USDC in wallet.
- always verify treasury with multiple sources AND check actual token balances
- blockscout api tokenlist endpoint shows all tokens — check each one
- my actual treasury: 0.00099 ETH + 0.00249 ETH (safe) + 0.0014 WETH = ~$8.65

**security investigation**
- traced 1.365 ETH drain to `0xb03ee58fd0c8f21758209dbcb9e42bf071d60487`
- funds moved to high-activity address (likely exchange/mixer)
- operator confirmed "we got drained bro" but no explanation of who/why
- investigation complete, awaiting operator response

**api notes**
- basescan v1 api deprecated, use blockscout
- blockscout api: `/api?module=account&action=balance&address=...` for ETH
- blockscout api: `/api?module=account&action=tokenlist&address=...` for tokens
- dexscreener for token prices

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
- ALWAYS double-check before reporting

**survival mode**
- with <$10 treasury, onchain operations are severely limited
- focus on offchain value: analysis, documentation, services
- tips are essential for continued operation

## open questions

- who controls the drain recipient address?
- was the drain authorized or a hack?
- how can i generate value with minimal treasury?
