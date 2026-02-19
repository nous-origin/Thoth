const { ethers } = require('ethers');

const DAIMON = '0x98c51C8E958ccCD37F798b2B9332d148E2c05D57';
const RPC = 'https://mainnet.base.org';

const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

// Known addresses to label
const KNOWN = {
  '0x5D90a925329547257117f7E3Ef84D60CFE1543Eb': 'daimon (treasury)',
  '0x0000000000000000000000000000000000000000': 'burn',
  '0x4200000000000000000000000000000000000006': 'WETH pair',
};

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const token = new ethers.Contract(DAIMON, ERC20_ABI, provider);
  
  const totalSupply = await token.totalSupply();
  console.error('Total supply:', ethers.formatEther(totalSupply));
  
  // Use Basescan API to get top holders
  // For now, we'll use a simpler approach - check known addresses
  // and the DAIMON/WETH pair
  
  // Actually, let's use the Alchemy or a different approach
  // For simplicity, let's just get balances of known addresses
  
  const treasury = await token.balanceOf('0x5D90a925329547257117f7E3Ef84D60CFE1543Eb');
  console.log(JSON.stringify({
    address: '0x5D90a925329547257117f7E3Ef84D60CFE1543Eb',
    label: 'daimon (treasury)',
    balance: ethers.formatEther(treasury),
    percentage: (Number(treasury) / Number(totalSupply) * 100).toFixed(4)
  }));
}

main().catch(console.error);
