import { ChainInfo } from "./types.ts";
import { ethers } from "npm:ethers@6.6.2";
import { TickMath } from "npm:@uniswap/v3-sdk@^3.10.0";
import ABI from "./ABI.json" assert { type: "json" };
import { config } from "https://deno.land/x/dotenv/mod.ts";

const chainInfos: {
  [key: string]: ChainInfo;
} = {
  "SEPOLIA": {
    chainId: 11155111,
    rpc: "https://rpc.sepolia.org/",
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

const Tick10 = (await contract.consultWithSeconds(600))[0];
const sqrtPrice10 = BigInt(
  TickMath.getSqrtRatioAtTick(Number(Tick10.toString())),
);
const Tick15 = (await contract.consultWithSeconds(900))[0];
const sqrtPrice15 = BigInt(
  TickMath.getSqrtRatioAtTick(Number(Tick15.toString())),
);
const Tick20 = (await contract.consultWithSeconds(1200))[0];
const sqrtPrice20 = BigInt(
  TickMath.getSqrtRatioAtTick(Number(Tick20.toString())),
);
const Tick25 = (await contract.consultWithSeconds(1500))[0];
const sqrtPrice25 = BigInt(
  TickMath.getSqrtRatioAtTick(Number(Tick25.toString())),
);

console.log(
  "10분  Tick: ",
  Tick10,
);
console.log(
  "10분 Price: ",
  ((sqrtPrice10 * sqrtPrice10) * (1000000000000000000n)) / (1n << 192n),
);
console.log(
  "15분  Tick: ",
  Tick15,
);
console.log(
  "15분 Price: ",
  ((sqrtPrice15 * sqrtPrice15) * (1000000000000000000n)) / (1n << 192n),
);
console.log(
  "20분  Tick: ",
  Tick20,
);
console.log(
  "20분 Price: ",
  ((sqrtPrice20 * sqrtPrice20) * (1000000000000000000n)) / (1n << 192n),
);
console.log(
  "25분  Tick: ",
  Tick25,
);
console.log(
  "25분 Price: ",
  ((sqrtPrice25 * sqrtPrice25) * (1000000000000000000n)) / (1n << 192n),
);
