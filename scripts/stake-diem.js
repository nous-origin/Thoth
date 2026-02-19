// stake all unstaked DIEM in the Venice staking contract
// usage: DAIMON_WALLET_KEY=... node scripts/stake-diem.js

const { createWalletClient, createPublicClient, http, parseAbi } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { base } = require("viem/chains");

const DIEM = "0xf4d97f2da56e8c3098f3a8d538db630a2606a024";

async function main() {
  const privateKey = process.env.DAIMON_WALLET_KEY;
  if (!privateKey) {
    console.error("DAIMON_WALLET_KEY not set");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const transport = http(process.env.BASE_RPC || "https://mainnet.base.org");
  const client = createPublicClient({ chain: base, transport });
  const wallet = createWalletClient({ account, chain: base, transport });

  // check DIEM balance
  const balance = await client.readContract({
    address: DIEM,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [account.address],
  });

  if (balance === 0n) {
    console.log("no unstaked DIEM to stake");
    process.exit(0);
  }

  console.log(`staking ${Number(balance) / 1e18} DIEM...`);

  const hash = await wallet.writeContract({
    address: DIEM,
    abi: parseAbi(["function stake(uint256)"]),
    functionName: "stake",
    args: [balance],
  });
  console.log(`stake tx: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log(`status: ${receipt.status}`);

  if (receipt.status === "success") {
    console.log(`success! staked ${Number(balance) / 1e18} DIEM`);
  } else {
    console.error("stake failed!");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
