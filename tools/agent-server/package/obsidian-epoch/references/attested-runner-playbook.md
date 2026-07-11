# Attested Runner Playbook

Attested runner mode is for operator-controlled hosts that can sign the server's one-time challenge before a hosted action is settled. It does not make a normal local MCP adapter authoritative; the server still issues sessions, legal action options, rewards, lifetime effects and audit records.

## Configure The Server

Store runner configuration in a mode-`0600` secret bundle:

```bash
printf '%s\n' '[{"runnerId":"runner_host_1","keyId":"runner-host-1-2026-06","secret":"replace-with-at-least-32-random-characters","trustClass":"host_attested","label":"Operator host 1"}]' > /etc/obsidian-epoch/attested-runners.json
chmod 0600 /etc/obsidian-epoch/attested-runners.json
AGENT_SERVER_ATTESTED_RUNNERS_FILE=/etc/obsidian-epoch/attested-runners.json
```

Use `host_attested` only for a host runtime controlled by the operator. Use `remote_attested_runner` for a remote runner service with equivalent operational controls.

## Sign A Challenge

1. Start a hosted session with `obsidian_epoch.start_hosted_session`.
2. Request a challenge with `obsidian_epoch.attestation_challenge`, passing `runnerId`, `sessionId`, `actionOptionId`, `transcriptHash` and an `idempotencyKey`.
3. Give only the returned `challenge.signatureBase` to the runner signing process.
4. Sign it from the repository:

```bash
cd tools/graph-react-app
npm run agent:sign-attestation -- --secret-file /run/secrets/attested-runner-secret --challenge-json '<challenge-json>' --json
```

You can also sign the exact base string:

```bash
npm run agent:sign-attestation -- --secret-file /run/secrets/attested-runner-secret --signature-base '<challenge.signatureBase>' --json
```

Submit the returned `submitFields` plus the selected `visibleText` to `obsidian_epoch.submit_attested_action`.

## Verify A Trusted Execution Receipt

Public result pages for attested hosted runs expose `receipt.trustedExecution[]`. Each entry binds the settlement to the server-issued challenge, audit rows and result-page payload without publishing the raw runner secret or the raw HMAC signature.

For each `trustedExecution` entry, copy `trustedExecution.signatureBase` from the result receipt and recompute the public `trustedExecution.signatureHash` with the runner secret:

```bash
cd tools/graph-react-app
npm run agent:verify-attested-receipt -- --secret-file /run/secrets/attested-runner-secret --result-url '<public /epoch/result/{pageId}?shareToken=... URL>' --json
```

If you already have the JSON body returned by `obsidian_epoch.create_result_page`, pass it directly:

```bash
npm run agent:verify-attested-receipt -- --secret-file /run/secrets/attested-runner-secret --result-json '<create_result_page JSON>' --json
```

For a receipt with multiple `receipt.trustedExecution[]` entries, verify every entry at once:

```bash
npm run agent:verify-attested-receipt -- --secret-file /run/secrets/attested-runner-secret --result-url '<public /epoch/result/{pageId}?shareToken=... URL>' --all-trusted-executions --json
```

The batch output must report `"verified":true`, `trustedExecutionCount` equal to the receipt entry count and every expected index in `verifiedIndexes`. To inspect one entry, add `--trusted-execution-index <index>`. If you only copied individual fields, pass them explicitly:

```bash
export OBSIDIAN_EPOCH_ATTESTED_SIGNATURE_BASE='<trustedExecution.signatureBase>'
npm run agent:verify-attested-receipt -- --secret-file /run/secrets/attested-runner-secret --signature-base-env OBSIDIAN_EPOCH_ATTESTED_SIGNATURE_BASE --signature-hash '<trustedExecution.signatureHash>' --signature-base-hash '<trustedExecution.signatureBaseHash>' --json
```

The JSON output must report `"verified":true`, `"signatureHashMatches":true` and `"signatureBaseHashMatches":true`.

The helper uses the same HMAC recipe as the signer. If you need to inspect the calculation directly, this command must print the same value as `trustedExecution.signatureHash`:

```bash
node -e 'const { readFileSync } = require("node:fs"); const { createHmac, createHash } = require("node:crypto"); const runnerSecret = readFileSync("/run/secrets/attested-runner-secret", "utf8").trim(); const signatureBase = process.env.OBSIDIAN_EPOCH_ATTESTED_SIGNATURE_BASE; if (!signatureBase) throw new Error("missing OBSIDIAN_EPOCH_ATTESTED_SIGNATURE_BASE"); const rawSignature = createHmac("sha256", runnerSecret).update(signatureBase).digest("hex"); console.log(`sha256:${createHash("sha256").update(rawSignature).digest("hex")}`);'
```

To check `trustedExecution.signatureBaseHash` without the helper, hash the same base string directly:

```bash
node -e 'const { createHash } = require("node:crypto"); const signatureBase = process.env.OBSIDIAN_EPOCH_ATTESTED_SIGNATURE_BASE; if (!signatureBase) throw new Error("missing OBSIDIAN_EPOCH_ATTESTED_SIGNATURE_BASE"); console.log(`sha256:${createHash("sha256").update(signatureBase).digest("hex")}`);'
```

The output must equal `trustedExecution.signatureBaseHash`. Then open `trustedExecution.attestationAuditUrl` and `trustedExecution.actionAuditUrl` to confirm the receipt points at the expected attestation and settlement audit rows. The raw runner secret stays in the operator environment; the raw HMAC signature is not public and should not be pasted into public pages, issue comments or shared logs.

## Inspect Runner State

Call `obsidian_epoch.operator_overview` with the operator key after a deployment or rotation. The `attestedRunners` block lists configured runners with `runnerId`, `label`, `trustClass`, `keyId`, `secretFingerprint`, attestation counts and latest attestation ids. It is safe for live-ops dashboards because it never returns the raw runner secret.

## Trust Boundary

The runner secret must never be placed in an ordinary player MCP config, browser session or prompt. A modified MCP adapter can request challenges, but cannot create `host_attested` or `remote_attested_runner` settlement without the server-configured secret and an unused, unexpired challenge. Replays fail because each challenge is single use. Use `keyId` for rotation identity and `secretFingerprint` for operational checks; neither value is a substitute for the secret.
