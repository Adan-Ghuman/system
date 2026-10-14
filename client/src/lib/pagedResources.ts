import { api } from './api.js';
import { fetchAllPages, PaginatedData } from './requestPolicy.js';

export function loadAllRecords<T>(url: string, params: Record<string, unknown> = {}): Promise<PaginatedData<T>> {
  return fetchAllPages(async pageParams => {
    const response = await api.get<{ success: boolean; data: PaginatedData<T> }>(url, { params: pageParams });
    return response.data.data;
  }, params);
}
