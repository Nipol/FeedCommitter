import { ethers } from "npm:ethers@6.6.2";
import ABI from "./ABI.json" assert { type: "json" };
import { config } from "https://deno.land/x/dotenv/mod.ts";

const chainInfos = {
  "SEPOLIA": {
    chainId: 11155111,
    rpc: "https://rpc.sepolia.dev",
    targetAddr: config().FFF_ADDRESS,
    privKey: config().PRIVATE_KEY,
  },
  "LOCALNET": {
    chainId: 31337,
    rpc: "http://127.0.0.1:8545",
    targetAddr: config().FFF_ADDRESS,
    privKey:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
};

const provider = new ethers.JsonRpcProvider(chainInfos[config().NETWORK].rpc);
const contract = new ethers.Contract(
  chainInfos[config().NETWORK].targetAddr,
  ABI,
  provider,
);

console.log(
  " FR : ",
  ethers.formatUnits(await contract.observeWithSeconds(0, 75), 5),
);
console.log(
  " 5분: ",
  ethers.formatUnits(await contract.observeWithSeconds(0, 300), 5),
);
console.log(
  "10분: ",
  ethers.formatUnits(await contract.observeWithSeconds(0, 600), 5),
);
