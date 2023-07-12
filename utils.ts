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
