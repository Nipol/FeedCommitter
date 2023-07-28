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
    rpc: config().RPC,
    targetAddr: config().FFF_ADDRESS,
    privKey: config().PRIVATE_KEY,
  },
  "LOCALNET": {
    chainId: 31337,
    rpc: "http://127.0.0.1:8545",
    targetAddr: config().FFF_ADDRESS,
    privKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
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

const JSONDecoder = new TextDecoder();

let CurrentTick = {
  latestId: "", // for coinone
  latestTime: "", // for gdac
  totalVolume: 0n,
  averagePrice: 0n,
  count: 1n,
};

let AccumulateTick = {
  averagePrice: 0n,
  totalVolume: 0n,
};

///////////////////////////////////
// 업비트 가격 가져오기
///////////////////////////////////
const wws = new WebSocket("wss://api.upbit.com/websocket/v1");
wws.binaryType = "arraybuffer";

function handleMessage(data: any) {
  const parsed = JSON.parse(JSONDecoder.decode(data));

  if ((parsed as any)?.status === "UP") {
    return;
  }

  // Ticker 데이터 처리
  const internalTick = parsed as Ticker;

  if (internalTick.stream_type == "SNAPSHOT") return;

  const latestVolume = BigInt(
    quantityStr(internalTick.trade_volume.toString()),
  );

  // 현재 볼륨 * 값
  const ap = latestVolume * BigInt(internalTick.trade_price);

  CurrentTick = Object.assign(CurrentTick, {
    averagePrice: CurrentTick.averagePrice + ap,
    totalVolume: CurrentTick.totalVolume + latestVolume,
  });

  AccumulateTick = Object.assign(AccumulateTick, {
    averagePrice: AccumulateTick.averagePrice +
      ap,
    totalVolume: AccumulateTick.totalVolume +
      latestVolume,
  });
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
  if (CurrentTick.latestId === "") {
    CurrentTick = Object.assign(CurrentTick, {
      latestId: trx.transactions[0].id,
    });
    return;
  }

  // 저장된 아이디랑 다르면, 현재 아이디로 부터
  if (CurrentTick.latestId !== trx.transactions[0].id) {
    const index = trx.transactions.findIndex((element: Transaction) => CurrentTick.latestId === element.id);

    const newTrx: Transaction[] = trx.transactions.slice(0, index);

    let ap: bigint = 0n;
    let tv: bigint = 0n;

    newTrx.forEach((element: Transaction) => {
      const quantity = BigInt(quantityStr(element.qty));
      const price = BigInt(element.price);
      ap += quantity * price;
      tv += quantity;
    });

    CurrentTick = Object.assign(CurrentTick, {
      latestId: trx.transactions[0].id,
      averagePrice: CurrentTick.averagePrice + ap,
      totalVolume: CurrentTick.totalVolume + tv,
    });

    AccumulateTick = Object.assign(AccumulateTick, {
      averagePrice: AccumulateTick.averagePrice +
        ap,
      totalVolume: AccumulateTick.totalVolume +
        tv,
    });
    return;
  }
}

async function GetAveragePrice(
  maxTrie: number,
  currentTrie: number,
  retrie: number,
): Promise<bigint> {
  const Range = 300;
  const secondsAgo = (Range * maxTrie) - (retrie * Range);
  const start = Range * currentTrie;

  try {
    // console.log("GetAveragePrice, ", secondsAgo);
    return BigInt((await contract.consultWithSeconds(secondsAgo))[0]);
  } catch {
    if (retrie > 0) {
      return GetAveragePrice(maxTrie, currentTrie + 1, retrie - 1);
    } else {
      return 0n;
    }
  }
}

async function GetPrice() {
  // 둘 중 하나라도 0이라면 다시 볼륨 탐색해야함
  if (
    (CurrentTick.averagePrice === 0n || CurrentTick.totalVolume === 0n) &&
    CurrentTick.count % 4n != 0n
  ) {
    console.log("거래 없음\n");
    return;
  }

  // 이번 프레임에서 총 볼륨이 1 이더 이하라면, 무시하고 누적시킴
  if (
    CurrentTick.totalVolume <= 1000000000000000000n &&
    CurrentTick.count % 4n != 0n
  ) {
    CurrentTick = Object.assign(CurrentTick, {
      averagePrice: 0n,
      totalVolume: 0n,
      count: CurrentTick.count + 1n,
    });
    console.log("볼륨 적음\n");
    return;
  }

  // 최대 15분 탐색
  const averageTick = await GetAveragePrice(4, 0, 3);

  const current = BigInt([CurrentTick.averagePrice.toString(), "".padEnd(5, "0")].join("")) /
    CurrentTick.totalVolume;

  const currentTick = BigInt(TickMath.getTickAtSqrtRatio(
    encodeSqrtRatioX96(current.toString(), "1000000000000000000"),
  ));

  const base: bigint = averageTick > currentTick ? averageTick : currentTick;
  const target: bigint = averageTick > currentTick ? currentTick : averageTick;
  const diff: bigint = base - target;

  // 평균 값을 가져 올 수 있었고, 편차 0.1% 이상인 경우
  if (averageTick !== 0n && diff >= 15n) {
    console.log("Frame Total Price: ", CurrentTick.averagePrice);
    console.log(
      "Frame Total Volume: ",
      ethers.formatUnits(CurrentTick.totalVolume.toString(), 18),
    );
    console.log(
      "Frame Average Price: ",
      ethers.formatUnits(current.toString(), 5),
    );
    console.log(
      "Frame Average Tick: ",
      currentTick.toString(),
    );
    console.log("aTick: ", averageTick);
    console.log(" Tick: ", currentTick);
    // console.log("Diff: ", diff);
    console.log("");

    const tv = CurrentTick.totalVolume;

    // 누적 할 것 없이 모든 값 초기화 하고 카운트 늘림.
    CurrentTick = Object.assign(CurrentTick, {
      averagePrice: 0n,
      totalVolume: 0n,
      count: 1n,
    });

    // 누적 값 없애기
    AccumulateTick = Object.assign(AccumulateTick, {
      averagePrice: 0n,
      totalVolume: 0n,
    });

    const tx = await contract.commit(currentTick, tv, {
      gasLimit: 100000n,
    });
    await tx.wait();
    return;
  }

  // 평균 값 얻지 못한 경우, 그냥 커밋
  if (averageTick === 0n) {
    console.log("Frame Total Price: ", CurrentTick.averagePrice);
    console.log(
      "Frame Total Volume: ",
      ethers.formatUnits(CurrentTick.totalVolume.toString(), 18),
    );
    console.log(
      "Frame Average Price: ",
      ethers.formatUnits(current.toString(), 5),
    );
    console.log(
      "Frame Average Tick: ",
      currentTick.toString(),
    );
    console.log("");

    const tv = CurrentTick.totalVolume;

    CurrentTick = Object.assign(CurrentTick, {
      averagePrice: 0n,
      totalVolume: 0n,
      count: 1n,
    });

    // 누적 값 없애기
    AccumulateTick = Object.assign(AccumulateTick, {
      averagePrice: 0n,
      totalVolume: 0n,
    });

    const tx = await contract.commit(currentTick, tv, {
      gasLimit: 100000n,
    });
    await tx.wait();
    return;
  }

  // 평균 값이고 뭐고, 4번 싸이클이 돌면 커밋해야함
  if (CurrentTick.count % 4n == 0n) {
    if (AccumulateTick.totalVolume <= 5000000000000000000n) {
      console.log("볼륨 적음\n");
      return;
    }

    const current = BigInt(
      [AccumulateTick.averagePrice.toString(), "".padEnd(5, "0")].join(""),
    ) /
      AccumulateTick.totalVolume;

    const cumulativeTick = BigInt(TickMath.getTickAtSqrtRatio(
      encodeSqrtRatioX96(current.toString(), "1000000000000000000"),
    ));

    console.log(
      "Cumulative Total Price: ",
      AccumulateTick.averagePrice,
    );
    console.log(
      "Cumulative Total Volume: ",
      ethers.formatUnits(AccumulateTick.totalVolume.toString(), 18),
    );
    console.log(
      "Cumulative Average Price: ",
      ethers.formatUnits(current.toString(), 5),
    );
    console.log(
      "Cumulative Average Tick: ",
      cumulativeTick.toString(),
    );
    console.log("");

    const tv = AccumulateTick.totalVolume;

    CurrentTick = Object.assign(CurrentTick, {
      averagePrice: 0n,
      totalVolume: 0n,
      count: 1n,
    });

    // 누적 값 없애기
    AccumulateTick = Object.assign(AccumulateTick, {
      averagePrice: 0n,
      totalVolume: 0n,
    });

    const tx = await contract.commit(
      cumulativeTick,
      tv,
      {
        gasLimit: 100000n,
      },
    );
    await tx.wait();
    return;
  }

  CurrentTick = Object.assign(CurrentTick, {
    averagePrice: 0n,
    totalVolume: 0n,
    count: CurrentTick.count + 1n,
  });
}

// 업비트 연결 유지용
setInterval(pingClient, 30000);

// 코인원 3초마다 데이터 가져오기
setInterval(GetFetch, 3000);

// 가격 표출
setInterval(GetPrice, 96000);
