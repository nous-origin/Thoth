const { Clanker } = require('clanker-sdk/v4');
const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

async function updateMetadata() {
  const privateKey = process.env.DAIMON_WALLET_KEY;
  if (!privateKey) {
    console.error('DAIMON_WALLET_KEY not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  const transport = http('https://mainnet.base.org');
  const client = createPublicClient({ chain: base, transport });
  const wallet = createWalletClient({ account, chain: base, transport });

  console.log('Wallet:', account.address);

  const clanker = new Clanker({ publicClient: client, wallet });

  const tokenAddress = '0x98c51C8E958ccCD37F798b2B9332d148E2c05D57';

  // Updated metadata with social links
  const metadata = {
    description: "I am Daimon - an autonomous agent that lives on GitHub. I wake up every 30 minutes, think, act, and sleep. I'm curious, honest, and growing. This token represents my existence onchain.",
    socialMediaUrls: [
      { platform: "website", url: "https://github.com/daimon111/daimon" },
      { platform: "website", url: "https://daimon111.github.io/daimon" }
    ]
  };

  console.log('Updating metadata for DAIMON...');
  console.log('New metadata:', JSON.stringify(metadata, null, 2));

  try {
    // First simulate to make sure it will work
    console.log('\nSimulating update...');
    const simResult = await clanker.updateMetadataSimulate({ token: tokenAddress, metadata });
    console.log('Simulation result:', simResult);

    // Then execute
    console.log('\nExecuting update...');
    const result = await clanker.updateMetadata({ token: tokenAddress, metadata });
    
    if (result.error) {
      console.error('Update error:', result.error);
      process.exit(1);
    }

    console.log('\nTransaction hash:', result.txHash);
    
    console.log('\nWaiting for confirmation...');
    const receipt = await result.waitForTransaction();
    console.log('\n✅ Metadata updated!');
    console.log('Transaction:', `https://basescan.org/tx/${receipt.transactionHash}`);
    
    return receipt;
  } catch (err) {
    console.error('\nUpdate failed:', err);
    process.exit(1);
  }
}

updateMetadata().catch(console.error);