
import currencyList from "../config/currency";

export function denomDivide(amount: number) {
  const result: typeof currencyList = [];

  for (const currency of currencyList) {
    while (amount >= currency.num) {
      result.push(currency);
      amount -= currency.num;
    }
  }

  return result;
}
