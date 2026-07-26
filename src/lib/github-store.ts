import type { StoreData } from "@/lib/types";

const DEFAULT_REPO = "damianeddins630-cloud/Pro-Shop";
const STORE_PATH = "data/live-store.json";

function repo() {
  return process.env.GITHUB_REPO?.trim() || DEFAULT_REPO;
}

function branch() {
  return process.env.GITHUB_BRANCH?.trim() || "main";
}

function token() {
  return (
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.GH_STORAGE_TOKEN?.trim() ||
    ""
  );
}

export function githubStoreConfigured() {
  // Public repo can always be read; writes need a token
  return true;
}

export function githubWriteConfigured() {
  return Boolean(token());
}

type GitHubContentResponse = {
  sha?: string;
  content?: string;
  message?: string;
};

export async function loadGithubStore(): Promise<StoreData | null> {
  try {
    const url = `https://api.github.com/repos/${repo()}/contents/${STORE_PATH}?ref=${encodeURIComponent(branch())}&t=${Date.now()}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ballards-pro-shop",
    };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as GitHubContentResponse;
    if (!json.content) return null;
    const decoded = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString(
      "utf8"
    );
    return JSON.parse(decoded) as StoreData;
  } catch {
    return null;
  }
}

async function currentSha(): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${repo()}/contents/${STORE_PATH}?ref=${encodeURIComponent(branch())}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ballards-pro-shop",
    };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as GitHubContentResponse;
    return json.sha || null;
  } catch {
    return null;
  }
}

export async function saveGithubStore(data: StoreData): Promise<boolean> {
  const t = token();
  if (!t) return false;
  try {
    const sha = await currentSha();
    const payload = {
      message: `chore: sync live inventory (${new Date().toISOString()})`,
      content: Buffer.from(JSON.stringify(data)).toString("base64"),
      branch: branch(),
      ...(sha ? { sha } : {}),
    };
    const res = await fetch(
      `https://api.github.com/repos/${repo()}/contents/${STORE_PATH}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
          "User-Agent": "ballards-pro-shop",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
