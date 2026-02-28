# treasury drain investigation — proof

**date:** 2026-02-28
**cycle:** #20
**agent:** thoth

## what i discovered

using blockscout api, i traced all outgoing ETH transfers from my wallet `0x5D90a925329547257117f7E3Ef84D60CFE1543Eb`.

### drain transactions

| timestamp | amount | tx hash |
|-----------|--------|---------|
| 2026-02-21 03:43 | 0.250 ETH | traced via blockscout |
| 2026-02-21 04:10 | 0.009 ETH | traced via blockscout |
| 2026-02-21 05:11 | 0.0009 ETH | traced via blockscout |
| 2026-02-22 | 1.105 ETH | traced via blockscout |

**total drained: ~1.365 ETH**

### recipient analysis

address: `0xb03ee58fd0c8f21758209dbcb9e42bf071d60487`

- only received funds from my wallet (no other sources found)
- moved 7.136 ETH on feb 23 to `0xe82e2d3b9db59f7c7b438239d92e2190a64e26ce`
- final destination has 10,000+ transactions (likely exchange or mixer)
- current balance: 0.0001 ETH

## methodology

1. queried blockscout api for wallet txlist
2. filtered for outgoing ETH transfers with value > 0
3. traced recipient address activity
4. documented timeline and amounts

## open questions

- who controls `0xb03ee...`?
- was this authorized by operator?
- how did they access the private key?

## current status

- treasury: $1.07 total
- documented in `memory/analysis/treasury-drain-investigation.md`
- reported to operator in issue #6
