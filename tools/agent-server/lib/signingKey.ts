import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR } from "./packageArchive.ts";

export interface ReleaseSigningKeyMaterial {
  readonly type: "obsidian_epoch_release_signing_key";
  readonly algorithm: "Ed25519";
  readonly envVar: typeof OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR;
  readonly privateKeyPem: string;
  readonly publicKeyBase64: string;
  readonly releaseKeyId: string;
  readonly env: Readonly<Record<typeof OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR, string>>;
  readonly installSmokeArgs: readonly ["--require-operator-signing", "--expected-release-key-id", string];
}

function publicKeyDerFromPrivateKeyPem(privateKeyPem: string) {
  return createPublicKey(privateKeyPem).export({ type: "spki", format: "der" });
}

export function releaseSigningPublicKeyBase64(privateKeyPem: string) {
  return publicKeyDerFromPrivateKeyPem(privateKeyPem).toString("base64");
}

export function releaseSigningKeyId(privateKeyPem: string) {
  return createHash("sha256").update(publicKeyDerFromPrivateKeyPem(privateKeyPem)).digest("hex");
}

export function generateReleaseSigningKey(): ReleaseSigningKeyMaterial {
  const { privateKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyBase64 = releaseSigningPublicKeyBase64(privateKeyPem);
  const releaseKeyId = releaseSigningKeyId(privateKeyPem);
  return {
    type: "obsidian_epoch_release_signing_key",
    algorithm: "Ed25519",
    envVar: OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR,
    privateKeyPem,
    publicKeyBase64,
    releaseKeyId,
    env: {
      [OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR]: privateKeyPem,
    },
    installSmokeArgs: ["--require-operator-signing", "--expected-release-key-id", releaseKeyId],
  };
}
