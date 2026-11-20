#!/usr/bin/env node
/**
 * Merge SPI catalog products into live-store + seed JSON files.
 * - Keeps existing non-SPI products (Turbo*, Ember, coaching, etc.)
 * - Exact name "Vengeance": merge weight options/meta; prefer existing price/active/stock
 * - Add/replace products with id starting with spi_
 * - Does not invent prices
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "data", "spi-catalog-2026-11-14.json");
const TARGETS = [
  path.join(ROOT, "data", "live-store.json"),
  path.join(ROOT, "data", "seed.json"),
  path.join(ROOT, "src", "data", "seed.json"),
];

function sumWeightStock(weightStock) {
  if (!weightStock || typeof weightStock !== "object") return 0;
  return Object.values(weightStock).reduce(
    (s, n) => s + Math.max(0, Math.floor(Number(n) || 0)),
    0
  );
}

function mergeVengeance(existing, spiCandidate) {
  const weightOptions = [
    ...new Set([
      ...(Array.isArray(existing.weightOptions) ? existing.weightOptions : []),
      ...(Array.isArray(spiCandidate.weightOptions) ? spiCandidate.weightOptions : []),
    ]),
  ]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const weightStock = {};
  const variantMeta = { ...(existing.variantMeta || {}) };
  const hadWeightStock =
    existing.weightStock &&
    typeof existing.weightStock === "object" &&
    Object.keys(existing.weightStock).length > 0;

  for (const w of weightOptions) {
    const key = String(w);
    const existingQty = existing.weightStock?.[key];
    const spiQty = spiCandidate.weightStock?.[key];
    if (existingQty != null && Number.isFinite(Number(existingQty))) {
      weightStock[key] = Math.max(0, Math.floor(Number(existingQty)));
    } else if (spiQty != null) {
      weightStock[key] = Math.max(0, Math.floor(Number(spiQty) || 0));
    } else {
      weightStock[key] = 0;
    }
    if (spiCandidate.variantMeta?.[key]) {
      variantMeta[key] = spiCandidate.variantMeta[key];
    }
  }

  // Preserve existing unsized stock by parking it on 15 lb (or nearest option)
  // so normalizeProduct does not zero inventory when weightOptions are added.
  const existingStock = Math.max(0, Math.floor(Number(existing.stock) || 0));
  if (
    weightOptions.length > 0 &&
    !hadWeightStock &&
    existingStock > 0 &&
    sumWeightStock(weightStock) === 0
  ) {
    const prefer =
      weightOptions.find((w) => w === 15) ??
      weightOptions.find((w) => w === 14) ??
      weightOptions[Math.floor(weightOptions.length / 2)];
    weightStock[String(prefer)] = existingStock;
  }

  const stock =
    weightOptions.length > 0
      ? sumWeightStock(weightStock) || existingStock
      : existingStock;

  return {
    ...existing,
    weightOptions: weightOptions.length ? weightOptions : existing.weightOptions,
    weightStock: weightOptions.length ? weightStock : existing.weightStock,
    variantMeta: Object.keys(variantMeta).length ? variantMeta : existing.variantMeta,
    stock,
    // Prefer existing commercial fields
    price: existing.price ?? spiCandidate.price ?? 0,
    active: existing.active ?? false,
    featured: existing.featured ?? false,
    image: existing.image || spiCandidate.image,
    brand: existing.brand || spiCandidate.brand,
    description: existing.description || spiCandidate.description,
    sku: existing.sku || spiCandidate.sku,
    upc: existing.upc || spiCandidate.upc,
  };
}

function mergeStore(store, spiProducts) {
  const products = Array.isArray(store.products) ? [...store.products] : [];
  const spiByName = new Map(
    spiProducts.map((p) => [String(p.name).trim().toLowerCase(), p])
  );

  // 1) Merge Vengeance (exact name) into existing non-spi product
  const vengeanceSpi = spiProducts.find((p) => p.name === "Vengeance");
  let vengeanceMerged = false;
  for (let i = 0; i < products.length; i++) {
    if (products[i].name === "Vengeance" && vengeanceSpi) {
      products[i] = mergeVengeance(products[i], vengeanceSpi);
      vengeanceMerged = true;
      break;
    }
  }

  // 2) Drop previous spi_ products (and the spi Vengeance parent if we merged into existing)
  const kept = products.filter((p) => !String(p.id || "").startsWith("spi_"));

  // 3) Add/replace all spi_ products except skip spi Vengeance when merged into existing
  const toAdd = spiProducts.filter((p) => {
    if (vengeanceMerged && p.name === "Vengeance") return false;
    return true;
  });

  // Avoid duplicate names for non-vengeance when an existing product already has same name?
  // Spec: add/replace spi_ only; keep Ember etc. Even if SPI also has Ember, both can exist
  // unless id is spi_. Keep as-is.

  const nextProducts = [...kept, ...toAdd];

  const now = new Date().toISOString();
  return {
    ...store,
    products: nextProducts,
    updatedAt: now,
    catalogUpdatedAt: now,
  };
}

function categoryCounts(products) {
  const by = {};
  for (const p of products) {
    by[p.category] = (by[p.category] || 0) + 1;
  }
  return by;
}

function main() {
  if (!fs.existsSync(CATALOG)) {
    console.error(`Missing catalog: ${CATALOG}`);
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const spiProducts = catalog.products || [];
  console.log(`SPI catalog products: ${spiProducts.length}`);

  for (const target of TARGETS) {
    if (!fs.existsSync(target)) {
      console.warn(`Skip missing: ${target}`);
      continue;
    }
    const store = JSON.parse(fs.readFileSync(target, "utf8"));
    const before = (store.products || []).length;
    const nonSpiBefore = (store.products || []).filter(
      (p) => !String(p.id || "").startsWith("spi_")
    ).length;
    const merged = mergeStore(store, spiProducts);
    fs.writeFileSync(target, JSON.stringify(merged, null, 2) + "\n");
    const after = merged.products.length;
    const spiCount = merged.products.filter((p) =>
      String(p.id || "").startsWith("spi_")
    ).length;
    const vengeance = merged.products.find((p) => p.name === "Vengeance");
    console.log(`\n${path.relative(ROOT, target)}`);
    console.log(`  before: ${before} (non-spi ${nonSpiBefore}) → after: ${after} (spi_ ${spiCount})`);
    console.log(`  categories:`, categoryCounts(merged.products));
    if (vengeance) {
      console.log(
        `  Vengeance: id=${vengeance.id} price=${vengeance.price} active=${vengeance.active} weights=${JSON.stringify(vengeance.weightOptions || [])} variantMetaKeys=${Object.keys(vengeance.variantMeta || {}).join(",")}`
      );
    }
  }
}

main();
