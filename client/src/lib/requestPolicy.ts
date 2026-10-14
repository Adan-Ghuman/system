import { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function createRequestPolicy(adapter: AxiosAdapter, getSessionKey: () => string, readThrottleMs = 300): AxiosAdapter {
  const pending = new Map<string, Promise<AxiosResponse>>();
  const recentReads = new Map<string, { expires: number; response: AxiosResponse }>();
  let revision = 0;
  return (config) => {
    const method = (config.method || 'get').toUpperCase();
    const isRead = method === 'GET';
    if (config.url?.includes('/auth/') || config.signal || config.data instanceof FormData) return adapter(config);
    const key = JSON.stringify([getSessionKey(), isRead ? revision : null, method, config.baseURL, config.url, stableValue(config.params), config.data, config.responseType]);
    if (pending.has(key)) return pending.get(key)!;
    const recent = recentReads.get(key);
    if (isRead && recent && recent.expires > Date.now()) return Promise.resolve({ ...recent.response, config });
    if (!isRead) { revision++; recentReads.clear(); }
    const startedAtRevision = revision;
    const request = adapter(config).then(response => {
      if (isRead && revision === startedAtRevision) {
        recentReads.set(key, { expires: Date.now() + readThrottleMs, response });
        setTimeout(() => recentReads.delete(key), readThrottleMs + 1);
      } else if (!isRead) { revision++; recentReads.clear(); }
      return response;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}

export interface PaginatedData<T> { items: T[]; total: number; page: number; limit: number; totalPages: number; }

export async function fetchAllPages<T>(getPage: (params: AxiosRequestConfig['params']) => Promise<PaginatedData<T>>, params: Record<string, unknown> = {}): Promise<PaginatedData<T>> {
  const first = await getPage({ ...params, page: 1, limit: 100 });
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await getPage({ ...params, page, limit: 100 });
    items.push(...next.items);
  }
  return { ...first, items };
}
