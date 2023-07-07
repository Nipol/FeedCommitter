import { Address } from "npm:micro-eth-signer@0.6.2";
import { ChainInfo, Ticker } from "./types.ts";

const chainInfos: ChainInfo[] = [
    {
        chainId: 11155111,
        rpc: "https://rpc.sepolia.dev",
        targetAddr: "",
        privKey: ""
    }
]

const wws = new WebSocket("wss://api.upbit.com/websocket/v1");
wws.binaryType = "blob";

const Frame = 75n;

let isDryrun = false;
let latestTimestamp = 0n;
let latestVolume = 0n;
let summedVolume = 0n;
let summedPrice = 0n;

function handleMessage(data: any) {
  if (data instanceof Blob) {
    const reader = new FileReader();

    reader.onload = () => {
      if (!reader.result) return;

      const Tick = JSON.parse(reader.result as string) as Ticker;

      // 지난 시간 확인
      const lastTimestamp = latestTimestamp % Frame;

      // 마지막 접근 시간 저장
      latestTimestamp = BigInt(Tick.timestamp.toString().substring(0, 10)) %
        Frame;

      if (lastTimestamp > latestTimestamp) { // 한 번 싸이클이 돈 경우
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

console.log("Frame Size: ", Frame.toString(), "sec");

// SAMPLE ㅋㅋ
const privateKey = '6b911fd37cdf5c81d4c0adb1ab7fa822ed253ab0ad9aa18d77257c88b29b718e';
const addr = Address.fromPrivateKey(privateKey);
console.log('Verified', Address.verifyChecksum(addr), addr);