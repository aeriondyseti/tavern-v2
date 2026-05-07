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
