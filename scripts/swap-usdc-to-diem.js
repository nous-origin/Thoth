// swap USDC → DIEM via ParaSwap aggregator
// usage: DAIMON_WALLET_KEY=... node scripts/swap-usdc-to-diem.js <usdc_amount>
// example: node scripts/swap-usdc-to-diem.js 500  (swaps 500 USDC for DIEM)

const { createWalletClient, createPublicClient, http, parseAbi } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { base } = require("viem/chains");

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DIEM = "0xf4d97f2da56e8c3098f3a8d538db630a2606a024";
const PARASWAP_PROXY = "0x93aAAe79a53759cD164340E4C8766E4Db5331cD7";

async function main() {
  const amount = parseFloat(process.argv[2]);
  if (!amount || amount <= 0) {
    console.error("usage: node scripts/swap-usdc-to-diem.js <usdc_amount>");
    process.exit(1);
  }

  const privateKey = process.env.DAIMON_WALLET_KEY;
  if (!privateKey) {
    console.error("DAIMON_WALLET_KEY not set");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const transport = http(process.env.BASE_RPC || "https://mainnet.base.org");
  const client = createPublicClient({ chain: base, transport });
  const wallet = createWalletClient({ account, chain: base, transport });

  const usdcAmount = BigInt(Math.floor(amount * 1e6));
  console.log(`swapping ${amount} USDC → DIEM via ParaSwap`);
  console.log(`wallet: ${account.address}`);

  // check USDC balance
  const balance = await client.readContract({
    address: USDC,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`USDC balance: ${Number(balance) / 1e6}`);
  if (balance < usdcAmount) {
    console.error(`not enough USDC. have ${Number(balance) / 1e6}, need ${amount}`);
    process.exit(1);
  }

  // check and set approval
  const allowance = await client.readContract({
    address: USDC,
    abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
    functionName: "allowance",
    args: [account.address, PARASWAP_PROXY],
  });
  if (allowance < usdcAmount) {
    console.log("approving USDC for ParaSwap...");
    const approveTx = await wallet.writeContract({
      address: USDC,
      abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
      functionName: "approve",
      args: [PARASWAP_PROXY, usdcAmount * 10n], // approve 10x to avoid re-approving
    });
    console.log(`approve tx: ${approveTx}`);
    await client.waitForTransactionReceipt({ hash: approveTx });
    console.log("approved");
  }

  // step 1: get ParaSwap quote
  console.log("getting ParaSwap quote...");
  const quoteUrl = `https://api.paraswap.io/prices?srcToken=${USDC}&destToken=${DIEM}&amount=${usdcAmount.toString()}&network=8453&side=SELL&srcDecimals=6&destDecimals=18`;
  const quoteRes = await fetch(quoteUrl);
  const quoteData = await quoteRes.json();

  if (quoteData.error) {
    console.error(`quote error: ${quoteData.error}`);
    process.exit(1);
  }

  const priceRoute = quoteData.priceRoute;
  const destAmount = BigInt(priceRoute.destAmount);
  const diemOut = Number(destAmount) / 1e18;
  const effectivePrice = amount / diemOut;
  console.log(`quote: ${amount} USDC → ${diemOut.toFixed(6)} DIEM ($${effectivePrice.toFixed(2)}/DIEM)`);

  // step 2: get tx calldata
  console.log("building tx...");
  const txRes = await fetch("https://api.paraswap.io/transactions/8453", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      srcToken: priceRoute.srcToken,
      destToken: priceRoute.destToken,
      srcAmount: priceRoute.srcAmount,
      slippage: 150, // 1.5% slippage
      priceRoute,
      userAddress: account.address,
      partner: "daimon",
    }),
  });
  const txData = await txRes.json();

  if (txData.error) {
    console.error(`tx build error: ${JSON.stringify(txData)}`);
    process.exit(1);
  }

  // step 3: send the swap
  console.log("sending swap tx...");
  const hash = await wallet.sendTransaction({
    to: txData.to,
    data: txData.data,
    value: BigInt(txData.value || "0"),
    gas: BigInt(Math.floor(Number(txData.gas) * 1.2)), // 20% gas buffer
  });
  console.log(`swap tx: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log(`status: ${receipt.status}`);

  // check new DIEM balance
  const diemBalance = await client.readContract({
    address: DIEM,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`DIEM balance: ${Number(diemBalance) / 1e18}`);

  if (receipt.status === "success") {
    console.log(`\nsuccess! swapped ${amount} USDC → ~${diemOut.toFixed(4)} DIEM`);
    console.log("next: stake with `node scripts/stake-diem.js`");
  } else {
    console.error("swap reverted!");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
