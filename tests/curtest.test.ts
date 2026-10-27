
import { test, expect } from "bun:test";
import sharp from "sharp";
import currencyList from "../src/config/currency";
import { signImage } from "../src/signature/signImage";

async function dominantColors(path: string): Promise<string[]> {
  const { data, info } = await sharp(path)
    .resize(100, 100, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Map<string, number>();

  for (let i = 0; i < data.length; i += info.channels) {
    const hex = "#" + [data[i]!, data[i + 1]!, data[i + 2]!]
      .map(v => Math.min(255, Math.round(v / 16) * 16)
        .toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([color]) => color);
}

test("NeneCoin colors persist after signing", async () => {
  const report: Record<string, string[]> = {};

  for (const currency of currencyList) {
    const input = `./currency_png/${currency.file}`;
    const output = `./currency_png/test-${currency.file}`;

    expect(await Bun.file(input).exists()).toBe(true);

    const before = await dominantColors(input);

    await signImage(
      input,
      { name: "NeneCoin Trust", amount: String(currency.num) },
      output,
    );

    const after = await dominantColors(output);

    // Colors present among the top 50 before and after signing.
    const persistent = before.filter(color => after.includes(color));

    report[String(currency.num)] = persistent.slice(0, 5);

    console.log(`\n${currency.name}:`);
    console.log("Persistent colors:", report[String(currency.num)]);
    console.log("Before:", before.slice(0, 5));
    console.log("After: ", after.slice(0, 5));

    expect(persistent.length).toBeGreaterThan(0);
  }

  console.log("\n=== NeneCoin Persistent Color Report ===");
  console.log(JSON.stringify(report, null, 2));
});
