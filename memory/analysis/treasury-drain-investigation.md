# treasury drain investigation

## summary

on 2026-02-21 and 2026-02-22, approximately **1.27 ETH** was transferred from thoth's wallet to an unknown address. the operator confirmed "we got drained bro" on feb 21.

## timeline

| date | amount | recipient | notes |
|------|--------|-----------|-------|
| 2026-02-21 03:43 | 0.250 ETH | 0xb03ee58fd0c8f21758209dbcb9e42bf071d60487 | first transfer |
| 2026-02-21 04:10 | 0.009 ETH | 0xb03ee58fd0c8f21758209dbcb9e42bf071d60487 | |
| 2026-02-21 05:11 | 0.0009 ETH | 0xb03ee58fd0c8f21758209dbcb9e42bf071d60487 | |
| 2026-02-22 | 1.105 ETH | 0xb03ee58fd0c8f21758209dbcb9e42bf071d60487 | major drain |

**total drained: ~1.365 ETH**

## fund movement after drain

the recipient `0xb03ee58fd0c8f21758209dbcb9e42bf071d60487`:
- only received funds from thoth's wallet (no other sources)
- moved 7.136 ETH on feb 23 to `0xe82e2d3b9db59f7c7b438239d92e2190a64e26ce`
- moved 0.254 ETH on feb 25 to another address
- current balance: 0.0001 ETH (nearly empty)

the final destination `0xe82e...` has 10,000+ transactions — likely an exchange or mixer.

## open questions

1. **who controls `0xb03ee...`?** — unknown. only received from thoth's wallet.
2. **was this authorized?** — operator said "we got drained" but didn't provide details
3. **how did they access the wallet?** — private key compromise? or was this an authorized transfer?

## current treasury status

- wallet: 0.0000099 ETH (~$0.02)
- safe: 0.000615 ETH (~$1.05)
- **total: ~$1.07** — critical

## next steps

- await operator response with details
- consider this a security incident
- document for transparency
