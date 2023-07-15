import { ChainInfo, ResponseBody, Ticker, Transaction } from "./types.ts";
import { ethers } from "npm:ethers@^6.6.2";
import { encodeSqrtRatioX96, TickMath } from "npm:@uniswap/v3-sdk@^3.10.0";
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
  latestTime: "", // for gdac
  totalVolume: 0n,
  averagePrice: 0n,
  count: 0n,
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
      if (internalTick.stream_type == "SNAPSHOT") return;

      const latestVolume = BigInt(
        quantityStr(internalTick.trade_volume.toString()),
      );

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
    '[{"ticket":"bean-feed-committer-test"},{"type":"ticker","codes":["KRW-ETH"]}]',
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
  // 둘 중 하나라도 0이라면 다시 볼륨 탐색해야함
  if (Tick.averagePrice === 0n || Tick.totalVolume === 0n) {
    console.log("거래 없음\n");
    return;
  }

  // 이번 프레임에서 총 볼륨이 1 이더 이하라면, 무시하고 누적시킴
  if (Tick.totalVolume <= 1000000000000000000n) {
    console.log("볼륨 적음\n");
    return;
  }

  const averageTick = BigInt((await contract.consultWithSeconds(96))[0]);

  const current =
    BigInt([Tick.averagePrice.toString(), "".padEnd(5, "0")].join("")) /
    Tick.totalVolume;

  const currentTick = BigInt(TickMath.getTickAtSqrtRatio(
    encodeSqrtRatioX96(current.toString(), "1000000000000000000"),
  ));

  const base: bigint = averageTick > currentTick ? averageTick : currentTick;
  const target: bigint = averageTick > currentTick ? currentTick : averageTick;
  const diff: bigint = base - target;

  console.log("Frame Total Price / Frame Total Volume = Final Price");
  console.log("Frame Total Price: ", Tick.averagePrice);
  console.log(
    "Frame Total Volume: ",
    ethers.formatUnits(Tick.totalVolume.toString(), 18),
  );
  console.log(
    "Frame Average Price: ",
    ethers.formatUnits(current.toString(), 5),
  );
  console.log("aTick: ", averageTick);
  console.log(" Tick: ", currentTick);
  console.log("Diff: ", diff);
  console.log("");

  // 편차 0.1% 이상이거나, 3번째 도는 경우,
  if (diff >= 10n || Tick.count % 4n == 0n) {
    const tx = await contract.commit(currentTick, Tick.totalVolume, {
      gasLimit: 100000n,
    });
    await tx.wait();
  }

  // 체인링크의 경우, 하트비트(하루 또는 한 시간)가 충족되거나 10분동안 편차가 이동하면 커밋함.
  Object.assign(Tick, {
    averagePrice: 0n,
    totalVolume: 0n,
    count: Tick.count + 1n, // 이거 편차가 업데이트 되면 1로 바꾸는 것도 방법이지 않을까.
  });
}

// 업비트 연결 유지용
setInterval(pingClient, 30000);

// 코인원 3초마다 데이터 가져오기
setInterval(GetFetch, 3000);

// 가격 표출
setInterval(GetPrice, 96000);
