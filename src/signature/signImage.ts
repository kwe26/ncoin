
import { decryptKeyReturn } from "./keyDec";
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";
import sharp from "sharp";

type EmbedData = {
  name: string;
  amount: string;
};

export async function signImage(
  path: string,
  dEmbed: EmbedData,
  output: string,
) {
  // Generate a 7-character code: N + 6 alphanumeric characters
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const random = crypto.getRandomValues(new Uint8Array(6));
  const currCode =
    "N" + [...random].map((b) => chars[b % chars.length]).join("");

  // Fill the white area with the currency code
  const svg = Buffer.from(`
    <svg width="140" height="35" xmlns="http://www.w3.org/2000/svg">
      <rect width="140" height="35" fill="white"/>
      <text x="70" y="23" font-family="Arial" font-size="14"
        text-anchor="middle" fill="#222">${currCode}</text>
    </svg>
  `);

  const rendered = await sharp(path)
    .composite([{ input: svg, left: 188, top: 183 }])
    .png()
    .toBuffer();

  const image = new Uint8Array(rendered);

  // Calculate dominant colors
  const { data, info } = await sharp(image)
    .resize(100, 100, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Map<string, number>();

  for (let i = 0; i < data.length; i += info.channels) {
    const hex = [data[i], data[i + 1], data[i + 2]]
      .map((v) => (Math.min(255, Math.round(v! / 16) * 16))
        .toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  const currDomColors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hex]) => `#${hex}`);

  const payload = { currCode, ...dEmbed, currDomColors };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

  // Sign the final visible image and its currency data
  const signedBytes = new Uint8Array(image.length + payloadBytes.length);
  signedBytes.set(image);
  signedBytes.set(payloadBytes, image.length);

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await decryptKeyReturn(),
    signedBytes,
  );

  // Embed metadata in PNG
  const chunks = extractChunks(image);
  const metadata = new TextEncoder().encode(
    `NeneCoin\0${JSON.stringify({
      ...payload,
      signature: Buffer.from(signature).toString("base64"),
    })}`,
  );

  chunks.splice(chunks.length - 1, 0, {
    name: "tEXt",
    data: metadata,
  });

  await Bun.write(output, encodeChunks(chunks));

  return { currCode, currDomColors };
}
