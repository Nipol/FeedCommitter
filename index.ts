import { ChainInfo, ResponseBody, Ticker, Transaction } from "./types.ts";
import { ethers } from "npm:ethers@^6.6.2";
import ABI from "./ABI.json" assert { type: "json" };
import { config } from "https://deno.land/x/dotenv/mod.ts";
import { quantityStr } from "./utils.ts";

const chainInfos: {
  [key: string]: ChainInfo;
} = {
  "SEPOLIA": {
    chainId: 11155111,
    rpc: "https://rpc.sepolia.org/",
    targetAddr: "0x1Dc1421c0cee69247E2056c4Db7AC6b803A32CDb",
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

let Tick = {
  latestId: "", // for coinone
  totalVolume: 0n,
  averagePrice: 0n,
};

///////////////////////////////////
// 업비트 가격 가져오기
///////////////////////////////////
const wws = new WebSocket("wss://api.upbit.com/websocket/v1");
wws.binaryType = "blob";

function handleMessage(data: any) {
  if (data instanceof Blob) {
    const reader = new FileReader();

    reader.onload = () => {
      if (!reader.result) return;

      // PONG 처리
      if ((JSON.parse(reader.result as string) as any)?.status === "UP") {
        return;
      }

      // Ticker 데이터 처리
      const internalTick = JSON.parse(reader.result as string) as Ticker;

      // 거래정보 총합이면 삭제
      if(internalTick.stream_type == "SNAPSHOT") return;

      const latestVolume = BigInt([
        internalTick.trade_volume.toString().split(".")[0],
        internalTick.trade_volume.toString().split(".")[1].padEnd(18, "0"),
      ].join(""));

      // 현재 볼륨 * 값
      const ap = latestVolume * BigInt(internalTick.trade_price);

      Object.assign(Tick, {
        averagePrice: Tick.averagePrice + ap,
        totalVolume: Tick.totalVolume + latestVolume,
      });
    };

    reader.readAsText(data);
  } else {
    console.log("Result: " + data);
  }
}

function handleConnected(wws: WebSocket) {
  wws.send(
    '[{"ticket":"bean-feed-committer"},{"type":"ticker","codes":["KRW-ETH"]}]',
  );
}

function pingClient() {
  wws.send("PING");
}

wws.onopen = () => handleConnected(wws);
wws.onmessage = (m) => handleMessage(m.data);

///////////////////////////////////
// 코인원 가격 가져오기
///////////////////////////////////
async function GetFetch() {
  const resp = await fetch(
    "https://api.coinone.co.kr/public/v2/trades/KRW/ETH?size=50",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const trx = (await resp.json()) as ResponseBody;

  // 초기까지는 문제 없음
  if (Tick.latestId === "") {
    Object.assign(Tick, {
      latestId: trx.transactions[0].id,
    });
    return;
  }

  // 저장된 아이디랑 다르면, 현재 아이디로 부터
  if (Tick.latestId !== trx.transactions[0].id) {
    const index = trx.transactions.findIndex((element: Transaction) =>
      Tick.latestId === element.id
    );

    const newTrx: Transaction[] = trx.transactions.slice(0, index);

    let ap: bigint = 0n;
    let tv: bigint = 0n;

    newTrx.forEach((element: Transaction) => {
      const quantity = BigInt(quantityStr(element.qty));
      const price = BigInt(element.price);
      ap += quantity * price;
      tv += quantity;
    });

    Object.assign(Tick, {
      latestId: trx.transactions[0].id,
      averagePrice: Tick.averagePrice + ap,
      totalVolume: Tick.totalVolume + tv,
    });
    return;
  }
}

async function GetPrice() {
  if (Tick.averagePrice === 0n || Tick.totalVolume === 0n) {
    console.log("Zero0: ", Tick.latestId);
    console.log("Zero1: ", Tick.averagePrice);
    console.log("Zero2: ", Tick.totalVolume);
    return;
  }

  console.log("Frame Total Price / Frame Total Volume = Final Price");
  console.log("Final Price: ", Tick.averagePrice / Tick.totalVolume);
  console.log("Frame Total Price: ", Tick.averagePrice);
  console.log("Frame Total Volume: ", Tick.totalVolume);
  console.log(
    "KRW:ETH",
    BigInt([Tick.averagePrice.toString(), "".padEnd(5, "0")].join("")) /
      Tick.totalVolume,
  );
  console.log("");

  // const tx = await contract.commit(Tick.totalVolume, Tick.averagePrice, {
  //   gasLimit: 100000n,
  // });
  // await tx.wait();

  Object.assign(Tick, {
    averagePrice: 0n,
    totalVolume: 0n,
  });
}

// 업비트 연결 유지용
setInterval(pingClient, 30000);

// 코인원 10초마다 데이터 가져오기
setInterval(GetFetch, 3000);

// 가격 표출
setInterval(GetPrice, 75000);
