# Feed Committer

거래량이 낮은 KRW:ETH 가격을 신뢰성있게 제공할 수 있도록, Off-chain 거래소의
가격을 볼륨기반 가격 계산을 수행하고 주기적으로 업데이트하는 데몬 코드

API 제공자의 웹소켓의 명세상 지난 정보를 가장 먼저 보내므로, 구동후에, 한 번의
싸이클로 누적된 정보를 버린다음 다음 프레임에 정보를 커밋한다.

또한 프레임 동안 거래가 존재하지 않는 경우에도 다음 프레임에 정보를 커밋한다.

## Usage

평균 Price 값을 만들고, Frame 마다 커밋합니다.

```
$ deno run --allow-read --allow-net index.ts
Frame Total Price / Frame Total Volume = Final Price
Final Price:  2461090n
Frame Total Price:  29907681499710000000000000n
Frame Total Volume:  12152205950000000000n
KRW:ETH 246109073716n
Real Price:  2461000
```

현재 Price Feed에 기록된 정보의 평균 값을 조회합니다.

```
$ deno run --allow-read --allow-net read.ts
 FR:  2463345.15823
 5분:  2463900.45612
10분:  2463537.72038
```

## Spec

Frame: 75 sec

KRW decimal: 5

ETH decimal: 18
