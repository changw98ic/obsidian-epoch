#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, realpathSync, statSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const SCHEMA_VERSION = "obsidian-epoch.phase6-shop-gate.v1";
const MAX_ERRORS = 200;
const DECIMAL_INTEGER = /^-?(0|[1-9]\d*)$/;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;
const DEFAULT_MIN_SINK_SOURCE_BPS = 3000n;

const ERROR = Object.freeze({
  USAGE: "SHOP_GATE_USAGE",
  INPUT_PATH: "SHOP_GATE_INPUT_PATH",
  READ: "SHOP_GATE_READ",
  PARSE: "SHOP_GATE_PARSE",
  SECRET: "SHOP_GATE_SECRET_INPUT",
  OFFER_SHAPE: "SHOP_GATE_OFFER_SHAPE",
  OFFER_VERSION: "SHOP_GATE_OFFER_VERSION",
  NEGATIVE_PRICE: "SHOP_GATE_NEGATIVE_PRICE",
  FREE_SCARCE: "SHOP_GATE_FREE_SCARCE",
  STOCK: "SHOP_GATE_STOCK",
  LIMIT: "SHOP_GATE_LIMIT",
  INFINITE_REFRESH: "SHOP_GATE_INFINITE_REFRESH",
  PURCHASE_SHAPE: "SHOP_GATE_PURCHASE_SHAPE",
  PURCHASE_DEBIT: "SHOP_GATE_PURCHASE_DEBIT",
  SALE_SHAPE: "SHOP_GATE_SALE_SHAPE",
  SALE_CREDIT: "SHOP_GATE_SALE_CREDIT",
  FEE_TAX_SINK: "SHOP_GATE_FEE_TAX_SINK",
  IDEMPOTENCY: "SHOP_GATE_IDEMPOTENCY",
  ARBITRAGE: "SHOP_GATE_ARBITRAGE",
  MINT_BURN_REASON: "SHOP_GATE_MINT_BURN_REASON",
  SINK_SOURCE_RATIO: "SHOP_GATE_SINK_SOURCE_RATIO",
  ECONOMY_AUDIT: "SHOP_GATE_ECONOMY_AUDIT",
});

main();

function main() {
  const startedAt = new Date().toISOString();
  let result;
  try {
    result = run(process.argv.slice(2));
  } catch (caught) {
    const code = caught && typeof caught === "object" && caught.code ? String(caught.code) : ERROR.READ;
    result = emptyResult([error(code, "runtime")]);
  }

  const output = {
    schemaVersion: SCHEMA_VERSION,
    gate: "phase6-shop-gate",
    ok: result.errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    metrics: stringifyMetrics(result.metrics),
    hash: result.hash,
    errorCodes: unique(result.errors.map((entry) => entry.code)),
    errors: result.errors.slice(0, MAX_ERRORS),
    truncatedErrors: Math.max(0, result.errors.length - MAX_ERRORS),
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.ok ? 0 : 1;
}

function run(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    process.exit(0);
  }

  const root = realpathSync(process.cwd());
  const errors = [];
  const inputFiles = args.inputs.map((input) => validateInputPath(input, root, errors)).filter(Boolean);
  if (args.inputs.length === 0) errors.push(error(ERROR.USAGE, "missing-input"));

  const records = [];
  const contentHash = createHash("sha256");
  for (const file of inputFiles) {
    let text = "";
    try {
      text = readFileSync(file.real, "utf8");
    } catch {
      errors.push(error(ERROR.READ, "read-failed", { file: file.safe }));
      continue;
    }
    contentHash.update(file.safe);
    contentHash.update("\0");
    contentHash.update(createHash("sha256").update(text).digest("hex"));
    contentHash.update("\0");
    records.push(...parseText(text, file.safe, errors));
  }

  const secretState = { count: 0 };
  records.forEach((record, index) => scanSecrets(record.value, `record:${index}`, secretState));
  if (secretState.count > 0) errors.push(error(ERROR.SECRET, "secret-like-input", { count: secretState.count }));

  const events = [];
  const offers = new Map();
  const purchases = [];
  const sales = [];
  const audits = [];

  records.forEach((record, index) => {
    collectEvents(record.value).forEach((eventValue, eventIndex) => {
      events.push({ value: eventValue, file: record.file, line: record.line, index, eventIndex });
    });
    collectOffers(record.value).forEach((offerValue, offerIndex) => {
      offers.set(offerKey(offerValue, offerIndex), { value: offerValue, file: record.file, line: record.line, index });
    });
    collectOperations(record.value, "purchase").forEach((value) => purchases.push({ value, file: record.file, line: record.line, index }));
    collectOperations(record.value, "sell").forEach((value) => sales.push({ value, file: record.file, line: record.line, index }));
    collectAudits(record.value).forEach((value) => audits.push({ value, file: record.file, line: record.line, index }));
  });

  inferPurchasesFromEvents(events).forEach((value) => purchases.push(value));
  inferSalesFromEvents(events).forEach((value) => sales.push(value));

  const metrics = {
    files: inputFiles.length,
    records: records.length,
    offers: offers.size,
    purchases: purchases.length,
    sales: sales.length,
    economyAudits: audits.length,
    duplicateIdempotencyRequests: 0,
    idempotencyConflicts: 0,
    negativePriceOffers: 0,
    freeScarceOffers: 0,
    infiniteRefreshOffers: 0,
    arbitragePairs: 0,
    sourceMinor: 0n,
    sinkMinor: 0n,
    feeTaxSinkMinor: 0n,
    sinkSourceBasisPoints: "0",
  };

  validateOffers([...offers.values()], errors, metrics);
  validatePurchases(purchases, offers, errors, metrics);
  validateSales(sales, errors);
  validateIdempotency([...purchases, ...sales], errors, metrics);
  validateArbitrage([...offers.values()], purchases, sales, errors, metrics);
  validateAudits(audits, errors, metrics);

  if (metrics.sourceMinor > 0n) {
    const ratio = (metrics.sinkMinor * 10000n) / metrics.sourceMinor;
    metrics.sinkSourceBasisPoints = ratio.toString();
    if (ratio < args.minSinkSourceBps) {
      errors.push(error(ERROR.SINK_SOURCE_RATIO, "sink-source-ratio-below-floor", {
        minBasisPoints: args.minSinkSourceBps.toString(),
        actualBasisPoints: ratio.toString(),
      }));
    }
  }

  contentHash.update(JSON.stringify({
    counts: {
      offers: metrics.offers,
      purchases: metrics.purchases,
      sales: metrics.sales,
      audits: metrics.economyAudits,
    },
    codes: errors.map((entry) => entry.code).sort(),
    sinkSourceBasisPoints: metrics.sinkSourceBasisPoints,
  }));

  return { metrics, errors, hash: contentHash.digest("hex") };
}

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-shop-gate.mjs [--min-sink-source-bps N] --input <repo-jsonl> [--input <repo-jsonl>...]",
    "",
    "Reads repo-local shop offer, purchase, sale, and economy-audit JSON/JSONL records.",
    "Prints a redacted JSON summary and exits non-zero on gate failures.",
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { inputs: [], minSinkSourceBps: DEFAULT_MIN_SINK_SOURCE_BPS, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (SECRET_KEY.test(arg) || SECRET_VALUE.test(arg)) throw coded(ERROR.USAGE, "secret-like-argument");
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "--input") {
      const value = argv[index + 1];
      index += 1;
      if (!value || value.startsWith("-")) throw coded(ERROR.USAGE, "missing-input-value");
      if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) throw coded(ERROR.USAGE, "secret-like-input-path");
      args.inputs.push(value);
      continue;
    }
    if (arg.startsWith("--input=")) {
      const value = arg.slice("--input=".length);
      if (!value) throw coded(ERROR.USAGE, "missing-input-value");
      args.inputs.push(value);
      continue;
    }
    if (arg === "--min-sink-source-bps") {
      const raw = argv[index + 1];
      index += 1;
      const parsed = parseMinor(raw);
      if (parsed === undefined || parsed < 0n || parsed > 10000n) throw coded(ERROR.USAGE, "invalid-min-sink-source-bps");
      args.minSinkSourceBps = parsed;
      continue;
    }
    if (arg.startsWith("--min-sink-source-bps=")) {
      const parsed = parseMinor(arg.slice("--min-sink-source-bps=".length));
      if (parsed === undefined || parsed < 0n || parsed > 10000n) throw coded(ERROR.USAGE, "invalid-min-sink-source-bps");
      args.minSinkSourceBps = parsed;
      continue;
    }
    if (arg.startsWith("-")) throw coded(ERROR.USAGE, "unknown-flag");
    args.inputs.push(arg);
  }
  return args;
}

function validateInputPath(input, root, errors) {
  let real;
  try {
    const absolute = resolve(process.cwd(), input);
    if (!existsSync(absolute)) throw new Error("missing");
    real = realpathSync(absolute);
  } catch {
    errors.push(error(ERROR.INPUT_PATH, "not-found", { inputHash: hashValue(input) }));
    return undefined;
  }
  if (real !== root && !real.startsWith(`${root}${sep}`)) {
    errors.push(error(ERROR.INPUT_PATH, "outside-repository", { inputHash: hashValue(input) }));
    return undefined;
  }
  try {
    if (!statSync(real).isFile()) {
      errors.push(error(ERROR.INPUT_PATH, "not-file", { inputHash: hashValue(input) }));
      return undefined;
    }
  } catch {
    errors.push(error(ERROR.INPUT_PATH, "stat-failed", { inputHash: hashValue(input) }));
    return undefined;
  }
  return { real, safe: relative(root, real) || "." };
}

function parseText(text, file, errors) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const whole = tryJson(trimmed);
  if (whole !== undefined) return flattenRecords(whole).map((value, index) => ({ value, file, line: index + 1 }));

  const records = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parsed = extractJson(line);
    if (parsed === undefined) {
      errors.push(error(ERROR.PARSE, "json-line-parse-failed", { file, line: index + 1 }));
      return;
    }
    flattenRecords(parsed).forEach((value) => records.push({ value, file, line: index + 1 }));
  });
  return records;
}

function extractJson(line) {
  const trimmed = line.trim();
  const direct = tryJson(trimmed);
  if (direct !== undefined) return direct;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return tryJson(trimmed.slice(start, end + 1));
  return undefined;
}

function flattenRecords(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenRecords(entry, output));
    return output;
  }
  if (!isRecord(value)) return output;
  for (const key of ["records", "events", "runs", "receipts", "samples", "offers", "purchases", "sales"]) {
    if (Array.isArray(value[key])) {
      flattenRecords(value[key], output);
      return output;
    }
  }
  output.push(value);
  return output;
}

function collectEvents(value) {
  const result = [];
  walk(value, (entry) => {
    if (typeof entry.eventType === "string" || typeof entry.type === "string") result.push(entry);
  });
  return result;
}

function collectOffers(value) {
  const result = [];
  const seen = new WeakSet();
  walk(value, (entry) => {
    if (seen.has(entry)) return;
    if (looksLikeOffer(entry)) {
      seen.add(entry);
      result.push(entry);
    }
    if (isRecord(entry.shopOffers)) {
      for (const offer of Object.values(entry.shopOffers)) {
        if (isRecord(offer) && !seen.has(offer)) {
          seen.add(offer);
          result.push(offer);
        }
      }
    }
  });
  return result;
}

function collectOperations(value, operation) {
  const result = [];
  walk(value, (entry) => {
    const op = stringField(entry, "operation") || stringField(entry, "commandType") || stringField(entry, "eventType");
    if (operation === "purchase" && /purchase/.test(op || "") && (entry.quote || entry.deltas || entry.payload || entry.offerId || entry.value)) {
      result.push(entry.payload && isRecord(entry.payload) ? { ...entry.payload, eventId: entry.eventId || entry.payload.eventId } : entry);
    }
    if (operation === "sell" && /\bsell\b|sale/.test(op || "") && (entry.quote || entry.deltas || entry.payload || entry.resourceKey || entry.value)) {
      result.push(entry.payload && isRecord(entry.payload) ? { ...entry.payload, eventId: entry.eventId || entry.payload.eventId } : entry);
    }
  });
  return result;
}

function collectAudits(value) {
  const result = [];
  walk(value, (entry) => {
    if (typeof entry.ok === "boolean" && (
      Array.isArray(entry.assets)
      || Array.isArray(entry.feeSplits)
      || Array.isArray(entry.accountBalances)
      || Array.isArray(entry.findings)
      || Array.isArray(entry.mints)
      || Array.isArray(entry.burns)
    )) {
      result.push(entry);
    }
  });
  return result;
}

function inferPurchasesFromEvents(events) {
  const byCorrelation = groupEvents(events.filter((entry) => {
    const eventType = eventTypeOf(entry.value);
    const reason = stringField(payloadOf(entry.value), "reason");
    return eventType === "resource_spent" && reason.startsWith("shop_purchase:");
  }));
  return [...byCorrelation.values()].map((group) => ({
    value: {
      operation: "purchase",
      requestId: requestIdOf(group[0].value),
      resourceSpends: group.map((entry) => payloadOf(entry.value)),
      createdItems: events
        .filter((entry) => eventTypeOf(entry.value) === "item_created")
        .map((entry) => payloadOf(entry.value))
        .filter((payload) => Array.isArray(payload.sourceEventIds) && payload.sourceEventIds.some((id) => group.some((spent) => spent.value.eventId === id))),
    },
    file: group[0].file,
    line: group[0].line,
    index: group[0].index,
  }));
}

function inferSalesFromEvents(events) {
  return events
    .filter((entry) => eventTypeOf(entry.value) === "resource_granted" && /shop_sale|sale|sell/.test(stringField(payloadOf(entry.value), "reason")))
    .map((entry) => ({
      value: { operation: "sell", requestId: requestIdOf(entry.value), resourceCredits: [payloadOf(entry.value)] },
      file: entry.file,
      line: entry.line,
      index: entry.index,
    }));
}

function validateOffers(offers, errors, metrics) {
  offers.forEach((offerEntry, index) => {
    const offer = offerEntry.value;
    const loc = location(offerEntry, index);
    const id = stringField(offer, "offerId") || stringField(offer, "id");
    const version = firstString(offer, ["offerVersion", "version", "catalogVersion", "priceVersion", "contentVersion", "rulesetVersion"]);
    const price = priceOfOffer(offer);
    const scarce = isScarceOffer(offer);

    if (!id || !hasSellableAsset(offer)) errors.push(error(ERROR.OFFER_SHAPE, "missing-offer-id-or-asset", loc));
    if (!version) errors.push(error(ERROR.OFFER_VERSION, "missing-offer-version", loc));
    if (price.costs.length === 0) errors.push(error(ERROR.OFFER_SHAPE, "missing-price", loc));
    if (price.costs.some((cost) => cost.amount < 0n)) {
      metrics.negativePriceOffers += 1;
      errors.push(error(ERROR.NEGATIVE_PRICE, "negative-price", loc));
    }
    if (scarce && price.total <= 0n) {
      metrics.freeScarceOffers += 1;
      errors.push(error(ERROR.FREE_SCARCE, "free-scarce-offer", loc));
    }
    if (!validStock(offer)) errors.push(error(ERROR.STOCK, "invalid-or-missing-stock", loc));
    if (scarce && !hasLimit(offer)) errors.push(error(ERROR.LIMIT, "scarce-offer-limit-missing", loc));
    if (looksInfinitelyRefreshing(offer) && !hasRefreshGuard(offer)) {
      metrics.infiniteRefreshOffers += 1;
      errors.push(error(ERROR.INFINITE_REFRESH, "unbounded-refresh", loc));
    }
  });
}

function validatePurchases(purchases, offers, errors, metrics) {
  purchases.forEach((purchase, index) => {
    const value = operationValue(purchase.value);
    const loc = location(purchase, index);
    const offerId = stringField(value, "offerId") || stringField(value, "shopOfferId");
    const spends = resourceSpends(value);
    const quote = quoteOf(value);
    const totalDebit = spends.reduce((sum, spend) => sum + spend.amount, 0n) + quote.payFromBuyer;
    const fee = quote.feeMinor + feeLikeAmount(value);

    if (!offerId && !quote.assetKey && spends.length === 0) errors.push(error(ERROR.PURCHASE_SHAPE, "missing-offer-or-price", loc));
    if (spends.some((spend) => spend.amount <= 0n) || quote.hasQuote && quote.payFromBuyer <= 0n) {
      errors.push(error(ERROR.PURCHASE_DEBIT, "purchase-debit-not-positive", loc));
    }
    if (totalDebit <= 0n) errors.push(error(ERROR.PURCHASE_DEBIT, "purchase-missing-buyer-debit", loc));
    if (fee < 0n || fee > totalDebit) errors.push(error(ERROR.FEE_TAX_SINK, "purchase-fee-invalid", loc));
    metrics.feeTaxSinkMinor += fee;
    metrics.sinkMinor += fee;

    const offer = findOffer(offers, offerId);
    if (offer && spends.length > 0) {
      const expected = priceOfOffer(offer.value);
      if (expected.total > 0n && totalDebit < expected.total) {
        errors.push(error(ERROR.PURCHASE_DEBIT, "purchase-debit-below-offer-price", loc));
      }
    }
  });
}

function validateSales(sales, errors) {
  sales.forEach((sale, index) => {
    const value = operationValue(sale.value);
    const loc = location(sale, index);
    const quote = quoteOf(value);
    const credits = resourceCredits(value);
    const credited = credits.reduce((sum, credit) => sum + credit.amount, 0n) + quote.creditToSeller;
    const fee = quote.feeMinor + feeLikeAmount(value);
    if (!stringField(value, "resourceKey") && !stringField(value, "itemKey") && !quote.assetKey) {
      errors.push(error(ERROR.SALE_SHAPE, "missing-sale-asset", loc));
    }
    if (credited <= 0n) errors.push(error(ERROR.SALE_CREDIT, "sale-missing-seller-credit", loc));
    if (fee < 0n || (quote.grossMinor > 0n && fee >= quote.grossMinor)) {
      errors.push(error(ERROR.FEE_TAX_SINK, "sale-fee-invalid", loc));
    }
  });
}

function validateIdempotency(operations, errors, metrics) {
  const seen = new Map();
  operations.forEach((operation, index) => {
    const value = operationValue(operation.value);
    const key = stringField(value, "requestId")
      || stringField(value, "request_id")
      || stringField(value, "idempotencyKey")
      || stringField(value, "idempotency_key")
      || stringField(value, "actionId");
    if (!key) return;
    const fingerprint = hashValue(stableJson(redactVolatile(value)));
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, { fingerprint, operation, index });
      return;
    }
    metrics.duplicateIdempotencyRequests += 1;
    if (previous.fingerprint !== fingerprint) {
      metrics.idempotencyConflicts += 1;
      errors.push(error(ERROR.IDEMPOTENCY, "idempotency-key-conflict", {
        requestHash: hashValue(key),
        first: location(previous.operation, previous.index),
        second: location(operation, index),
      }));
    }
  });
}

function validateArbitrage(offers, purchases, sales, errors, metrics) {
  const buyByAsset = new Map();
  offers.forEach((offer) => {
    const asset = assetKeyOf(offer.value);
    const price = priceOfOffer(offer.value);
    if (asset && price.total > 0n) keepMin(buyByAsset, asset, price.total);
  });
  purchases.forEach((purchase) => {
    const value = operationValue(purchase.value);
    const asset = assetKeyOf(value) || stringField(value, "offerId");
    const price = resourceSpends(value).reduce((sum, spend) => sum + spend.amount, 0n) + quoteOf(value).payFromBuyer;
    if (asset && price > 0n) keepMin(buyByAsset, asset, price);
  });

  sales.forEach((sale, index) => {
    const value = operationValue(sale.value);
    const asset = assetKeyOf(value);
    const saleValue = resourceCredits(value).reduce((sum, credit) => sum + credit.amount, 0n) + quoteOf(value).creditToSeller;
    const buyValue = asset ? buyByAsset.get(asset) : undefined;
    if (asset && buyValue !== undefined && saleValue >= buyValue) {
      metrics.arbitragePairs += 1;
      errors.push(error(ERROR.ARBITRAGE, "buy-sell-roundtrip-nonnegative", {
        ...location(sale, index),
        assetHash: hashValue(asset),
        buyMinor: buyValue.toString(),
        sellMinor: saleValue.toString(),
      }));
    }
  });
}

function validateAudits(audits, errors, metrics) {
  audits.forEach((auditEntry, index) => {
    const audit = auditEntry.value;
    const loc = location(auditEntry, index);
    if (audit.ok === false) errors.push(error(ERROR.ECONOMY_AUDIT, "audit-not-ok", loc));
    if (Array.isArray(audit.findings) && audit.findings.length > 0) errors.push(error(ERROR.ECONOMY_AUDIT, "audit-findings-present", loc));

    collectMintBurnEntries(audit).forEach((entry) => {
      const amount = abs(parseMinor(entry.amount ?? entry.quantityMinor ?? entry.systemMintMinor ?? entry.systemBurnMinor) || 0n);
      const kind = entry.kind;
      if (kind === "mint") metrics.sourceMinor += amount;
      if (kind === "burn" || kind === "sink" || kind === "fee" || kind === "tax") metrics.sinkMinor += amount;
      if ((kind === "mint" || kind === "burn") && !reasonOf(entry.value)) {
        errors.push(error(ERROR.MINT_BURN_REASON, `${kind}-reason-missing`, loc));
      }
    });

    if (Array.isArray(audit.assets)) {
      audit.assets.forEach((asset) => {
        const mint = parseMinor(asset.systemMintMinor) || 0n;
        const burn = parseMinor(asset.systemBurnMinor) || 0n;
        metrics.sourceMinor += abs(mint);
        metrics.sinkMinor += abs(burn);
        if (mint !== 0n && !reasonOf(asset)) errors.push(error(ERROR.MINT_BURN_REASON, "asset-mint-reason-missing", loc));
        if (burn !== 0n && !reasonOf(asset)) errors.push(error(ERROR.MINT_BURN_REASON, "asset-burn-reason-missing", loc));
      });
    }
    if (Array.isArray(audit.feeSplits)) {
      audit.feeSplits.forEach((split) => {
        const fee = abs(parseMinor(split.totalMinor ?? split.feeMinor ?? split.amount) || 0n);
        metrics.feeTaxSinkMinor += fee;
        metrics.sinkMinor += fee;
        const unexplained = parseMinor(split.unexplainedShareMinor) || 0n;
        if (unexplained !== 0n || split.balanced === false) errors.push(error(ERROR.FEE_TAX_SINK, "fee-split-unbalanced", loc));
      });
    }
  });
}

function collectMintBurnEntries(audit) {
  const entries = [];
  for (const [key, kind] of [["mints", "mint"], ["sources", "mint"], ["burns", "burn"], ["sinks", "sink"], ["fees", "fee"], ["taxes", "tax"]]) {
    if (Array.isArray(audit[key])) {
      audit[key].forEach((value) => entries.push({ kind, value, amount: value?.amount ?? value?.quantityMinor ?? value?.totalMinor }));
    }
  }
  return entries;
}

function priceOfOffer(offer) {
  const costs = [];
  if (Array.isArray(offer.costs)) {
    offer.costs.forEach((cost) => {
      const amount = parseMinor(cost?.amount ?? cost?.quantityMinor ?? cost?.amountMinor);
      costs.push({ resource: String(cost?.resourceId || cost?.resourceKey || "price"), amount: amount ?? -1n });
    });
  }
  const unit = parseMinor(offer.baseUnitPriceMinor ?? offer.unitPriceMinor ?? offer.priceMinor ?? offer.price);
  const quantity = parseMinor(offer.quantityMinor ?? offer.quantity ?? 1) ?? 1n;
  if (unit !== undefined) costs.push({ resource: stringField(offer, "priceResourceKey") || "price", amount: unit * quantity });
  return { costs, total: costs.reduce((sum, cost) => sum + cost.amount, 0n) };
}

function quoteOf(value) {
  const quote = isRecord(value.quote) ? value.quote : value;
  const gross = parseMinor(quote.grossMinor ?? quote.gross ?? quote.priceMinor) || 0n;
  const total = parseMinor(quote.totalMinor ?? quote.total ?? quote.payMinor) || gross;
  const fee = parseMinor(quote.feeMinor ?? quote.fee ?? quote.taxMinor ?? quote.tax) || 0n;
  const operation = stringField(value, "operation") || stringField(value, "commandType") || "";
  return {
    hasQuote: isRecord(value.quote) || gross > 0n || total > 0n,
    assetKey: stringField(quote, "resourceKey") || stringField(value, "resourceKey") || stringField(value, "itemKey"),
    grossMinor: gross,
    feeMinor: fee,
    payFromBuyer: /sell/.test(operation) ? 0n : total + (isRecord(value.quote) && total === gross ? fee : 0n),
    creditToSeller: /sell/.test(operation) ? total : 0n,
  };
}

function resourceSpends(value) {
  const spends = [];
  for (const key of ["resourceSpends", "spends", "spentPayloads"]) {
    if (Array.isArray(value[key])) {
      value[key].forEach((entry) => {
        const amount = parseMinor(entry?.amount ?? entry?.quantityMinor ?? entry?.amountMinor);
        if (amount !== undefined) spends.push({ resource: String(entry.resourceId || entry.resourceKey || "price"), amount });
      });
    }
  }
  if (Array.isArray(value.deltas)) {
    value.deltas.forEach((delta) => {
      const amount = parseMinor(delta?.quantityMinor);
      if (amount !== undefined && amount < 0n && (delta.sinkType === "transfer" || stringField(delta, "resourceClass") === "currency")) {
        spends.push({ resource: String(delta.resourceKey || delta.assetKey || "price"), amount: -amount });
      }
    });
  }
  return spends;
}

function resourceCredits(value) {
  const credits = [];
  for (const key of ["resourceCredits", "credits", "grants"]) {
    if (Array.isArray(value[key])) {
      value[key].forEach((entry) => {
        const amount = parseMinor(entry?.amount ?? entry?.quantityMinor ?? entry?.amountMinor);
        if (amount !== undefined) credits.push({ resource: String(entry.resourceId || entry.resourceKey || "price"), amount });
      });
    }
  }
  if (Array.isArray(value.deltas)) {
    value.deltas.forEach((delta) => {
      const amount = parseMinor(delta?.quantityMinor);
      if (amount !== undefined && amount > 0n && stringField(delta, "resourceClass") === "currency") {
        credits.push({ resource: String(delta.resourceKey || delta.assetKey || "price"), amount });
      }
    });
  }
  return credits;
}

function feeLikeAmount(value) {
  let total = 0n;
  for (const key of ["feeMinor", "taxMinor", "sinkMinor"]) total += parseMinor(value[key]) || 0n;
  for (const key of ["fees", "taxes", "sinks"]) {
    if (Array.isArray(value[key])) {
      value[key].forEach((entry) => {
        total += parseMinor(entry?.amount ?? entry?.quantityMinor ?? entry?.totalMinor) || 0n;
      });
    }
  }
  return total;
}

function looksLikeOffer(value) {
  return isRecord(value)
    && (typeof value.offerId === "string" || typeof value.id === "string")
    && (Array.isArray(value.costs) || value.baseUnitPriceMinor !== undefined || value.priceMinor !== undefined || value.price !== undefined)
    && hasSellableAsset(value);
}

function hasSellableAsset(value) {
  return Boolean(stringField(value, "itemKey") || stringField(value, "resourceKey") || stringField(value, "sku") || stringField(value, "assetKey"));
}

function assetKeyOf(value) {
  return stringField(value, "itemKey")
    || stringField(value, "resourceKey")
    || stringField(value, "assetKey")
    || stringField(value, "sku");
}

function isScarceOffer(offer) {
  const rarity = stringField(offer, "rarity").toLowerCase();
  const asset = assetKeyOf(offer)?.toLowerCase() || "";
  return ["rare", "epic", "legendary", "unique", "relic", "scarce"].some((word) => rarity.includes(word) || asset.includes(word))
    || offer.bindOnAcquire === true
    || offer.unique === true
    || offer.scarce === true;
}

function validStock(offer) {
  const stock = parseMinor(offer.stock ?? offer.stockMinor ?? offer.available ?? offer.availableMinor ?? offer.inventory ?? offer.quantityAvailable);
  if (stock !== undefined) return stock >= 0n;
  return Boolean(offer.merchantAccountRef || offer.replenishmentSourceRef || offer.unlimited === true || offer.infinite === true);
}

function hasLimit(offer) {
  return ["purchaseLimit", "perAccountLimit", "perExplorerLimit", "dailyLimit", "maxPurchases", "limit"].some((key) => {
    const value = parseMinor(offer[key]);
    return value !== undefined && value > 0n;
  });
}

function looksInfinitelyRefreshing(offer) {
  return offer.unlimited === true
    || offer.infinite === true
    || offer.refresh === "infinite"
    || offer.refreshPolicy === "infinite"
    || (offer.replenishmentSourceRef && !hasLimit(offer));
}

function hasRefreshGuard(offer) {
  return hasLimit(offer)
    || Boolean(offer.cooldownSeconds || offer.refreshIntervalSeconds || offer.expiresAt || offer.restockCap || offer.maxStock || offer.replenishmentCap);
}

function findOffer(offers, offerId) {
  if (!offerId) return undefined;
  for (const offer of offers.values()) {
    const id = stringField(offer.value, "offerId") || stringField(offer.value, "id");
    if (id === offerId) return offer;
  }
  return undefined;
}

function offerKey(offer, fallback) {
  return `${stringField(offer, "offerId") || stringField(offer, "id") || `offer:${fallback}`}:${firstString(offer, ["offerVersion", "version", "catalogVersion", "priceVersion", "contentVersion"])}`;
}

function groupEvents(events) {
  const groups = new Map();
  events.forEach((entry) => {
    const key = requestIdOf(entry.value) || stringField(payloadOf(entry.value), "reason") || `${entry.file}:${entry.line}:${entry.eventIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return groups;
}

function requestIdOf(event) {
  return stringField(event, "idempotencyKey")
    || stringField(event, "requestId")
    || stringField(event, "correlationId")
    || stringField(event, "causationId")
    || stringField(event, "eventId");
}

function eventTypeOf(event) {
  return stringField(event, "eventType") || stringField(event, "type");
}

function payloadOf(event) {
  return isRecord(event.payload) ? event.payload : event;
}

function operationValue(value) {
  return isRecord(value.value) ? { ...value.value, events: value.events || value.value.events } : value;
}

function reasonOf(value) {
  return firstString(value, ["reason", "reasonCode", "sourceType", "sinkType", "sourceRef", "sinkRef", "source", "sink"]);
}

function firstString(record, keys) {
  for (const key of keys) {
    const value = stringField(record, key);
    if (value) return value;
  }
  return "";
}

function stringField(record, key) {
  const value = isRecord(record) ? record[key] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function parseMinor(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && DECIMAL_INTEGER.test(value.trim())) return BigInt(value.trim());
  return undefined;
}

function abs(value) {
  return value < 0n ? -value : value;
}

function keepMin(map, key, value) {
  const previous = map.get(key);
  if (previous === undefined || value < previous) map.set(key, value);
}

function redactVolatile(value) {
  if (Array.isArray(value)) return value.map(redactVolatile);
  if (!isRecord(value)) return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/^(createdAt|updatedAt|occurredAt|eventId|id|itemId|receiptId)$/i.test(key)) continue;
    output[key] = redactVolatile(entry);
  }
  return output;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function scanSecrets(value, pathName, state) {
  if (state.count > MAX_ERRORS) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSecrets(entry, `${pathName}[${index}]`, state));
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) state.count += 1;
      scanSecrets(entry, `${pathName}.${key}`, state);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) state.count += 1;
}

function walk(value, visit, depth = 0, seen = new WeakSet()) {
  if (!isRecord(value) || depth > 12 || seen.has(value)) return;
  seen.add(value);
  visit(value);
  for (const entry of Object.values(value)) {
    if (Array.isArray(entry)) {
      entry.forEach((item) => walk(item, visit, depth + 1, seen));
    } else {
      walk(entry, visit, depth + 1, seen);
    }
  }
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function hashValue(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function location(entry, index) {
  return {
    record: index + 1,
    ...(entry.file ? { file: entry.file } : {}),
    ...(entry.line !== undefined ? { line: entry.line } : {}),
  };
}

function error(code, message, details = undefined) {
  return {
    code,
    message,
    ...(details ? { details } : {}),
  };
}

function coded(code, message) {
  const failure = new Error(message);
  failure.code = code;
  return failure;
}

function stringifyMetrics(metrics) {
  const output = {};
  for (const [key, value] of Object.entries(metrics)) {
    output[key] = typeof value === "bigint" ? value.toString() : value;
  }
  return output;
}

function emptyResult(errors) {
  return {
    metrics: {
      files: 0,
      records: 0,
      offers: 0,
      purchases: 0,
      sales: 0,
      economyAudits: 0,
      duplicateIdempotencyRequests: 0,
      idempotencyConflicts: 0,
      negativePriceOffers: 0,
      freeScarceOffers: 0,
      infiniteRefreshOffers: 0,
      arbitragePairs: 0,
      sourceMinor: "0",
      sinkMinor: "0",
      feeTaxSinkMinor: "0",
      sinkSourceBasisPoints: "0",
    },
    errors,
    hash: createHash("sha256").update("phase6-shop-gate:error").digest("hex"),
  };
}
