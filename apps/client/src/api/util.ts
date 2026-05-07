export const json = async <T>(r: Response): Promise<T> => {
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`${r.status} ${r.statusText}: ${body}`);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
};

export const send = (url: string, init?: RequestInit) =>
  fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

// EventSource is GET-only; this is for POST endpoints that stream SSE.
export const consumeSseStream = (
  url: string,
  init: RequestInit,
  onFrame: (event: string, data: string) => void,
): (() => void) => {
  const ac = new AbortController();
  void (async () => {
    try {
      const r = await fetch(url, { ...init, signal: ac.signal });
      if (!r.ok || !r.body) {
        onFrame("error", JSON.stringify({ message: `${r.status} ${r.statusText}` }));
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        while (true) {
          const idx = buf.indexOf("\n\n");
          if (idx === -1) break;
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = chunk.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) {
              if (data) data += "\n";
              data += line.slice(5).trim();
            }
          }
          if (data) onFrame(event, data);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        onFrame("error", JSON.stringify({ message: e instanceof Error ? e.message : String(e) }));
      }
    }
  })();
  return () => ac.abort();
};
