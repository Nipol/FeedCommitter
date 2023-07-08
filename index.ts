import { Ticker } from "./types.ts";
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
const signer = new ethers.Wallet(
  chainInfos[config().NETWORK].privKey,
  provider,
);
const contract = new ethers.Contract(
  chainInfos[config().NETWORK].targetAddr,
  ABI,
  signer,
);

const wws = new WebSocket("wss://api.upbit.com/websocket/v1");
wws.binaryType = "blob";

const Frame = 75n;

let isDryrun = false;
let latestTimestamp = 0n;
let latestVolume = 0n;
let summedVolume = 0n;
let summedPrice = 0n;

// 들어온 데이터 정리
function handleMessage(data: any) {
  if (data instanceof Blob) {
    const reader = new FileReader();

    reader.onload = async () => {
      if (!reader.result) return;

      // PONG 처리
      if ((JSON.parse(reader.result as string) as any)?.status === "UP") {
        return;
      }

      // Ticker 데이터 처리
      const Tick = JSON.parse(reader.result as string) as Ticker;

      // 지난 시간 확인
      const lastTimestamp = latestTimestamp % Frame;

      // 마지막 접근 시간 저장
      latestTimestamp = BigInt(Tick.timestamp.toString().substring(0, 10)) %
        Frame;

      if (lastTimestamp > latestTimestamp) { // 한 번 싸이클이 돈 경우
        if (summedPrice <= 0n || summedVolume <= 0n) return;

        if (isDryrun) {
          console.log("Frame Total Price / Frame Total Volume = Final Price");
          console.log("Final Price: ", summedPrice / summedVolume);
          console.log("Frame Total Price: ", summedPrice);
          console.log("Frame Total Volume: ", summedVolume);
          console.log(
            "KRW:ETH",
            BigInt([summedPrice.toString(), "".padEnd(5, "0")].join("")) /
              summedVolume,
          );
          console.log("Real Price: ", Tick.trade_price);
          // console.log(await contract.getAddress());
          const tx = await contract.commit(summedVolume, summedPrice);
          await tx.wait();
          console.log("");
        }

        // 마지막 볼륨 값 불러옴
        const lastVolume = latestVolume;

        // 마지막 볼륨 값 업데이트
        latestVolume = BigInt([
          Tick.acc_trade_volume.toString().split(".")[0],
          Tick.acc_trade_volume.toString().split(".")[1].padEnd(18, "0"),
        ].join(""));

        // 볼륨의 차이로 실제 볼륨 가져옴.
        const currentVolume = latestVolume - lastVolume;

        // 현재 볼륨 * 값
        summedPrice = currentVolume * BigInt(Tick.trade_price);

        // 볼륨 누적
        summedVolume = currentVolume;

        isDryrun = true;
      } else if (lastTimestamp <= latestTimestamp) { // 싸이클이 돌지 않은 경우
        // 마지막 볼륨 값 불러옴
        const lastVolume = latestVolume;

        // 마지막 볼륨 값 업데이트
        latestVolume = BigInt([
          Tick.acc_trade_volume.toString().split(".")[0],
          Tick.acc_trade_volume.toString().split(".")[1].padEnd(18, "0"),
        ].join(""));

        // 볼륨의 차이로 실제 볼륨 가져옴.
        const currentVolume = latestVolume - lastVolume;

        // 현재 볼륨 * 값
        summedPrice += currentVolume * BigInt(Tick.trade_price);

        // 볼륨 누적
        summedVolume += currentVolume;
      }
    };

    reader.readAsText(data);
  } else {
    console.log("Result: " + data);
  }
}

function handleConnected(wws: WebSocket) {
  wws.send(
    '[{"ticket":"bean-the-dao-feed-committer"},{"type":"ticker","codes":["KRW-ETH"]}]',
  );
}

wws.onopen = () => handleConnected(wws);

wws.onmessage = (m) => handleMessage(m.data);

function pingClient() {
  wws.send("PING");
}
// Keep pinging the client every 30 seconds.
const ping = setInterval(pingClient, 30000);
