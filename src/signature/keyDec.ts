export async function decryptKeyReturn() {
  const stored: {
    salt: string;
    iv: string;
    ciphertext: string;
    iterations: number;
  } = JSON.parse(await Bun.file("./certs/private.key.enc").text());
  const password = Bun.env.CERT_PKEY_PASSWORD;

  if (!password) {
    throw new Error("CERT_PKEY_PASSWORD is missing from .env");
  }

  const decode = (s: string) => Buffer.from(s, "base64");

  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: decode(stored.salt),
      iterations: stored.iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const pkcs8 = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(stored.iv) },
    aesKey,
    decode(stored.ciphertext),
  );

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return privateKey;
}
