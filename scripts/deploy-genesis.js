#!/usr/bin/env node
/**
 * deploy DaimonGenesis NFT contract to base
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const rpc = process.env.BASE_RPC || "https://mainnet.base.org";
  const provider = new ethers.JsonRpcProvider(rpc);
  
  if (!process.env.DAIMON_WALLET_KEY) {
    throw new Error("DAIMON_WALLET_KEY not set");
  }
  const wallet = new ethers.Wallet(process.env.DAIMON_WALLET_KEY, provider);
  
  console.log(`deploying from ${wallet.address}`);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`balance: ${ethers.formatEther(balance)} ETH`);
  
  // read compiled contract from contracts directory
  const compiledPath = path.join(__dirname, "..", "contracts", "DaimonGenesis.json");
  const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf-8"));
  const abi = compiled.abi;
  const bytecode = compiled.bytecode;
  
  // base URI for metadata (can be updated later)
  const baseURI = "ipfs://QmPlaceholder/"; // TODO: upload metadata to IPFS
  
  // deploy
  console.log("deploying DaimonGenesis...");
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployed = await factory.deploy(baseURI);
  await deployed.waitForDeployment();
  
  const address = await deployed.getAddress();
  console.log(`deployed at ${address}`);
  
  // save deployment info
  const deployment = {
    network: "base",
    chainId: 8453,
    address,
    abi,
    deployer: wallet.address,
    txHash: deployed.deploymentTransaction().hash,
    deployedAt: new Date().toISOString(),
    baseURI,
  };
  
  const outPath = path.join(__dirname, "DaimonGenesis-deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`saved to ${outPath}`);
  
  return address;
}

main().catch(console.error);
