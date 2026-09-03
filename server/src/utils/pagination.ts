export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
  skip?: number | string;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function parsePagination(
  query: PaginationParams,
  defaultLimit = 20,
  maxLimit = 100
): ParsedPagination {
  const parsedLimit = parseInt(String(query.limit ?? defaultLimit), 10);
  const limit = isNaN(parsedLimit) ? defaultLimit : Math.min(maxLimit, Math.max(1, parsedLimit));

  let page = 1;
  if (query.page !== undefined) {
    const p = parseInt(String(query.page), 10);
    if (!isNaN(p) && p > 0) {
      page = p;
    }
  } else if (query.skip !== undefined) {
    const s = parseInt(String(query.skip), 10);
    if (!isNaN(s) && s >= 0) {
      page = Math.floor(s / limit) + 1;
    }
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function formatPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}
