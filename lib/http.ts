export const USER_AGENT = "LineupSurfForecast/1.0 (https://github.com/kmhoydich-arch/lineup)";

export async function fetchText(
  url: string,
  init?: { accept?: string; timeoutMs?: number },
): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: init?.accept ?? "application/json, text/plain, */*",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(init?.timeoutMs ?? 20000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      last = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  throw last instanceof Error ? last : new Error("Request failed");
}

export async function fetchJson(url: string, accept?: string): Promise<unknown> {
  const text = await fetchText(url, { accept });
  return JSON.parse(text) as unknown;
}
