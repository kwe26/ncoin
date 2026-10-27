import "reflect-metadata";
import * as x509 from "@peculiar/x509";
import { mkdir, writeFile, chmod } from "node:fs/promises";

const issueName = Bun.env.ISSUE_NAME;
const days = Number(Bun.env.CERT_DAYS ?? "3650");

if (!issueName) {
  throw new Error("ISSUE_NAME is missing from .env");
}

if (!Number.isInteger(days) || days < 1) {
  throw new Error("CERT_DAYS must be a positive integer");
}

if (!issueName) {
  throw new Error("ISSUE_NAME is missing from .env");
}

if (!Number.isInteger(days) || days < 1) {
  throw new Error("CERT_DAYS must be a positive integer");
}


const algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
  publicExponent: new Uint8Array([1, 0, 1]),
  modulusLength: 3072,
};

const keys = await crypto.subtle.generateKey(
  algorithm,
  true,
  ["sign", "verify"],
);

const now = new Date();

const certificate =
  await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: `CN=${issueName}`,
    notBefore: now,
    notAfter: new Date(now.getTime() + days * 86400000),
    signingAlgorithm: algorithm,
    keys,
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(
        x509.KeyUsageFlags.keyCertSign |
          x509.KeyUsageFlags.cRLSign |
          x509.KeyUsageFlags.digitalSignature,
        true,
      ),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
    ],
  });

const password = Bun.env.CERT_PKEY_PASSWORD;

if (!password) {
  throw new Error("CERT_PKEY_PASSWORD is missing from .env");
}

// Export the private key in PKCS#8 format.
const privateKey = await crypto.subtle.exportKey(
  "pkcs8",
  keys.privateKey,
);

// Derive an encryption key from the password.
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const material = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveKey"],
);

const encryptionKey = await crypto.subtle.deriveKey(
  {
    name: "PBKDF2",
    salt,
    iterations: 600_000,
    hash: "SHA-256",
  },
  material,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"],
);

const encrypted = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  encryptionKey,
  privateKey,
);

// Store metadata, salt, IV, and ciphertext together.
const output = {
  version: 1,
  algorithm: "AES-256-GCM",
  kdf: "PBKDF2-SHA256",
  iterations: 600_000,
  salt: Buffer.from(salt).toString("base64"),
  iv: Buffer.from(iv).toString("base64"),
  ciphertext: Buffer.from(encrypted).toString("base64"),
};

await mkdir("./certs", { recursive: true });

await writeFile(
  "./certs/private.key.enc",
  JSON.stringify(output, null, 2),
  { mode: 0o600 },
);

await writeFile(
  "./certs/certificate.crt",
  certificate.toString("pem"),
);

await chmod("./certs/private.key.enc", 0o600);

console.log("Encrypted private key saved to certs/private.key.enc");
console.log("Certificate saved to certs/certificate.crt");

console.log("Generated NeneCoin Trust certificate.");
console.log("Private key: certs/private.key");
console.log("Certificate: certs/certificate.crt");
