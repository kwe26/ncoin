
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";
import { X509Certificate } from "node:crypto";

export async function verifyImage(path: string): Promise<any> {
  try {
    const image = new Uint8Array(await Bun.file(path).arrayBuffer());
    const chunks = extractChunks(image);

    const index = chunks.findIndex((chunk) => {
      if (chunk.name !== "tEXt") return false;
      return new TextDecoder()
        .decode(chunk.data)
        .startsWith("NeneCoin\0");
    });

    if (index === -1) return false;

    const text = new TextDecoder().decode(chunks[index]!.data);
    const metadata = JSON.parse(text.slice("NeneCoin\0".length));

    if (
      typeof metadata.signature !== "string" ||
      typeof metadata.currCode !== "string" ||
      !/^[A-Z0-9]{7}$/.test(metadata.currCode)
    ) {
      return {
        signVerify: false,
        metadata,
      };
    }

    // Remove the embedded metadata to recover the signed image.
    chunks.splice(index, 1);
    const original = new Uint8Array(encodeChunks(chunks));

    // Reconstruct exactly the payload the signer signed.
    const { signature, ...payload } = metadata;
    const payloadBytes = new TextEncoder().encode(
      JSON.stringify(payload),
    );

    const signedBytes = new Uint8Array(
      original.length + payloadBytes.length,
    );
    signedBytes.set(original);
    signedBytes.set(payloadBytes, original.length);

    const certPem = await Bun.file("./certs/certificate.crt").text();
    const cert = new X509Certificate(certPem);

    const publicKey = await crypto.subtle.importKey(
      "spki",
      new Uint8Array(
        cert.publicKey.export({ type: "spki", format: "der" }),
      ),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    return {
      signVerify: await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        publicKey,
        new Uint8Array(Buffer.from(signature, "base64")),
        signedBytes,
      ),
      metadata,
    };
  } catch (error) {
    console.error("Image verification failed:", error);
    return false;
  }
}
