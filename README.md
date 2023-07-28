# Feed Committer

거래량이 낮은 KRW/ETH 가격을 신뢰성있게 제공할 수 있도록, Off-chain 거래소의 가격을 볼륨기반 가격 계산을 수행하고
주기적으로 업데이트하는 데몬 코드.

해당 코드는, 다음과 같은 조건에 의해 가격 정보를 커밋한다. `1 Frame`은 1분 36초이며, 프레임 동안애 모든 거래 정보들을
모으게 됩니다. 프레임의 거래량이 `1 Ether`이하라면, 다음 프레임으로 정보들을 미루게 됩니다. 또한 현재 프레임의 평균
가격이, Price Feed 컨트랙트가 제공하는 5분, 10분, 15분 평균 가격과 `15 Tick(0.15%)` 가격 차이가 생기는 경우에만 가격
정보를 제공하게 됩니다.

그러나 이러한 모든 조건에 의해서도 가격을 커밋하지 않으면 평균 값을 가져오는데 문제가 될 수 있으므로, 4번의 프레임마다
누적된 거래량과 가격 정보는 무조건 커밋 됩니다. 이 경우에도, 누적된 거래량이 `5 Ether` 이하라면, 1분 36초를 기다리게
됩니다. 이러한 가격 정보의 커밋 방식은 KRW/ETH에만 국한되며, 다른 페어에서의 정상 작동을 보장하지 않습니다.

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
$ deno run --allow-net --allow-read --allow-env read.ts
10분  Tick:  -152104n
10분 Price:  248048999740n
15분  Tick:  -152104n
15분 Price:  248048999740n
20분  Tick:  -152104n
20분 Price:  248048999740n
25분  Tick:  -152104n
25분 Price:  248048999740n
```

## Spec

Frame: 96 sec

KRW decimal: 5

ETH decimal: 18
