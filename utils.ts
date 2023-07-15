export const quantityStr = (element: string): string => {
  if (element.includes(".")) {
    return element.split(".").map((v, i) => {
      if (i == 1) {
        return v.padEnd(18, "0");
      }
      return v;
    }).join("");
  } else {
    return `${element}000000000000000000`;
  }
};

export const encodePriceSqrt = (reserve1: bigint, reserve0: bigint): bigint => {
  return sqrt(reserve1 * (2n ** 96n) * (2n ** 96n) / reserve0);
};

function sqrt(value) {
  if (value < 0n) {
    throw "square root of negative numbers is not supported";
  }

  if (value < 2n) {
    return value;
  }

  function newtonIteration(n, x0) {
    const x1 = ((n / x0) + x0) >> 1n;
    if (x0 === x1 || x0 === (x1 - 1n)) {
      return x0;
    }
    return newtonIteration(n, x1);
  }

  return newtonIteration(value, 1n);
}
