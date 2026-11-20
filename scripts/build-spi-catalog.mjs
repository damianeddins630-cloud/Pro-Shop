#!/usr/bin/env node
/**
 * Parse data/spi-raw-2026-11-14.txt (owner SHAREABLE UPC list) into
 * data/spi-catalog-2026-11-14.json products.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW = path.join(ROOT, "data", "spi-raw-2026-11-14.txt");
const OUT = path.join(ROOT, "data", "spi-catalog-2026-11-14.json");

const SECTION_MAP = [
  { match: /^SPI\s+BALLS/i, key: "balls" },
  { match: /^BAGS/i, key: "bags" },
  { match: /^SHOES/i, key: "shoes" },
  { match: /^Chemicals/i, key: "chemicals" },
  { match: /^PLUG/i, key: "plug" },
  { match: /^Wrist\s*\|\s*Access/i, key: "accessories" },
];

function titleCase(raw) {
  const keepUpper = new Set([
    "PWBA",
    "RH",
    "LH",
    "XL",
    "XS",
    "SM",
    "MD",
    "LG",
    "3G",
    "OZ",
    "BTLS",
    "SKU",
    "UPC",
    "II",
    "III",
    "IV",
    "UV",
  ]);
  return String(raw || "")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[^A-Za-z0-9]/g, "");
      if (!bare) return word;
      if (keepUpper.has(bare.toUpperCase())) {
        return word.replace(bare, bare.toUpperCase());
      }
      // Preserve decimal sizes like 4.5
      if (/^\d+(\.\d+)?$/.test(bare)) return word;
      // Hyphenated tokens
      if (word.includes("-")) {
        return word
          .split("-")
          .map((p) => {
            const b = p.replace(/[^A-Za-z0-9]/g, "");
            if (keepUpper.has(b.toUpperCase())) return p.replace(b, b.toUpperCase());
            if (/^\d/.test(p)) return p;
            return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
          })
          .join("-");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function inferBrand(name) {
  const n = String(name || "").toLowerCase();
  if (/\b900\s*global\b|\b900g\b/.test(n)) return "900 Global";
  if (/\broto\s*grip\b|\broto\b/.test(n)) return "Roto Grip";
  if (/\b3g\b/.test(n)) return "3G";
  if (/\bmaster\b/.test(n)) return "Master";
  if (/\bstorm\b/.test(n)) return "Storm";
  return "Storm";
}

function parseLine(line) {
  const trimmed = line.replace(/\s+$/, "");
  if (!trimmed.trim()) return null;
  if (/^SKU\t/i.test(trimmed) || /^SKU\s+DESCRIPTION/i.test(trimmed)) return null;

  let parts = trimmed.split("\t").map((p) => p.trim());
  if (parts.length < 3) {
    parts = trimmed.split(/\s{2,}/).map((p) => p.trim());
  }
  if (parts.length < 3) {
    // Fallback: SKU, then description, then trailing UPC digits
    const m = trimmed.match(/^(\S+)\s+(.+?)\s+(\d{8,})\s*$/);
    if (!m) return null;
    return { sku: m[1], description: m[2].trim(), upc: m[3] };
  }
  const sku = parts[0];
  const upc = parts[parts.length - 1].replace(/\s+/g, "");
  const description = parts.slice(1, -1).join(" ").trim();
  if (!sku || !description || !/^\d{8,}$/.test(upc)) return null;
  return { sku, description, upc };
}

function splitBallName(description) {
  const m = String(description).trim().match(/^(.*?)\s+(\d{1,2})$/);
  if (!m) return { base: description.trim(), weight: null };
  const weight = Number(m[2]);
  if (!Number.isFinite(weight) || weight < 6 || weight > 16) {
    return { base: description.trim(), weight: null };
  }
  return { base: m[1].trim(), weight };
}

function baseProduct({ id, name, slug, category, brand, description, sku, upc, extras = {} }) {
  return {
    id,
    name,
    slug,
    description,
    price: 0,
    stock: extras.stock ?? 0,
    category,
    brand,
    image: "/images/logo.png",
    featured: false,
    active: false,
    ...(sku ? { sku } : {}),
    ...(upc ? { upc } : {}),
    ...extras,
  };
}

function parseSections(text) {
  const lines = text.split(/\r?\n/);
  const buckets = {
    balls: [],
    bags: [],
    shoes: [],
    chemicals: [],
    plug: [],
    accessories: [],
  };
  let current = null;

  for (const line of lines) {
    const head = line.trim();
    let switched = false;
    for (const sec of SECTION_MAP) {
      if (sec.match.test(head)) {
        current = sec.key;
        switched = true;
        break;
      }
    }
    if (switched) continue;
    if (!current) continue;
    const row = parseLine(line);
    if (row) buckets[current].push(row);
  }
  return buckets;
}

function buildBalls(rows) {
  /** @type {Map<string, { name: string, weights: Map<number, {sku:string,upc:string}> }>} */
  const groups = new Map();
  for (const row of rows) {
    const { base, weight } = splitBallName(row.description);
    if (weight == null) {
      console.warn(`Skipping ball without weight: ${row.sku} ${row.description}`);
      continue;
    }
    const key = base.toUpperCase();
    if (!groups.has(key)) {
      groups.set(key, { name: titleCase(base), weights: new Map() });
    }
    groups.get(key).weights.set(weight, { sku: row.sku, upc: row.upc });
  }

  const usedSlugs = new Set();
  const products = [];
  for (const [, group] of groups) {
    let slug = slugify(group.name);
    if (usedSlugs.has(slug)) {
      const firstSku = [...group.weights.values()][0]?.sku || "x";
      slug = `${slug}-${slugify(firstSku)}`;
    }
    usedSlugs.add(slug);
    const weightOptions = [...group.weights.keys()].sort((a, b) => a - b);
    const weightStock = Object.fromEntries(weightOptions.map((w) => [String(w), 0]));
    const variantMeta = {};
    const skuLines = [];
    for (const w of weightOptions) {
      const meta = group.weights.get(w);
      variantMeta[String(w)] = meta;
      skuLines.push(`${w} lb: SKU ${meta.sku}, UPC ${meta.upc}`);
    }
    products.push(
      baseProduct({
        id: `spi_${slug}`,
        name: group.name,
        slug,
        category: "Bowling Ball",
        brand: inferBrand(group.name),
        description: `${group.name} bowling ball. Weight options from SPI catalog (11.14.26).\n${skuLines.join("\n")}`,
        extras: {
          stock: 0,
          weightOptions,
          weightStock,
          variantMeta,
        },
      })
    );
  }
  return products.sort((a, b) => a.name.localeCompare(b.name));
}

function buildSingles(rows, category, nameTransform = (d) => titleCase(d)) {
  const usedSlugs = new Set();
  const products = [];
  for (const row of rows) {
    const name = nameTransform(row.description);
    let slug = slugify(name);
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${slugify(row.sku)}`;
    }
    usedSlugs.add(slug);
    products.push(
      baseProduct({
        id: `spi_${slug}`,
        name,
        slug,
        category,
        brand: inferBrand(name),
        description: `${name}. SKU ${row.sku}. UPC ${row.upc}.`,
        sku: row.sku,
        upc: row.upc,
        extras: { stock: 0 },
      })
    );
  }
  return products;
}

function main() {
  if (!fs.existsSync(RAW)) {
    console.error(`Missing raw catalog: ${RAW}`);
    process.exit(1);
  }
  const text = fs.readFileSync(RAW, "utf8");
  const buckets = parseSections(text);

  const products = [
    ...buildBalls(buckets.balls),
    ...buildSingles(buckets.bags, "Bags"),
    ...buildSingles(buckets.shoes, "Shoes"),
    ...buildSingles(buckets.chemicals, "Chemicals"),
    ...buildSingles(buckets.plug, "Plug"),
    ...buildSingles(buckets.accessories, "Accessories"),
  ];

  const byCategory = {};
  for (const p of products) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }

  const catalog = {
    version: 1,
    sourceDate: "2026-11-14",
    sourceFile: "data/spi-raw-2026-11-14.txt",
    productCount: products.length,
    products,
  };

  fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
  console.log(`Products: ${products.length}`);
  console.log("By category:");
  for (const [cat, n] of Object.entries(byCategory).sort()) {
    console.log(`  ${cat}: ${n}`);
  }
  console.log(
    `Raw rows — balls:${buckets.balls.length} bags:${buckets.bags.length} shoes:${buckets.shoes.length} chemicals:${buckets.chemicals.length} plug:${buckets.plug.length} accessories:${buckets.accessories.length}`
  );
}

main();
