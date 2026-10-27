import { denomDivide } from "./src/functions/denomDivide";
import { signImage } from "./src/signature/signImage";
import { verifyImage } from "./src/signature/verifySign";

const result = await signImage(
  "./currency_png/100nc.png",
  { name: "NeneCoin Trust", amount: "100" },
  "./currency_png/100nc.signed.png",
);

// console.log(result);

console.log(await verifyImage("./currency_png/100nc.signed.png"))
