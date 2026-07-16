import { generateReleaseSigningKey } from "./lib/signingKey.ts";

function renderHumanOutput(material: ReturnType<typeof generateReleaseSigningKey>) {
  return [
    "Obsidian Epoch release signing key generated.",
    "",
    `Algorithm: ${material.algorithm}`,
    `Release key id: ${material.releaseKeyId}`,
    `Public key: ${material.publicKeyBase64}`,
    "",
    "Set this private key only in the production server environment:",
    `${material.envVar}=${JSON.stringify(material.privateKeyPem)}`,
    "",
    "Then pin the deployment smoke check:",
    `npm run agent:install-smoke -- --server <serverBase> ${material.installSmokeArgs.join(" ")} --json`,
  ].join("\n");
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const material = generateReleaseSigningKey();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(material));
  } else {
    console.log(renderHumanOutput(material));
  }
}
