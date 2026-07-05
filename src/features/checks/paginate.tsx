import { useEffect, useState } from "react";

export function useClientPagination<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setPage(0);
  }, [resetKey, limit]);

  const pageCount = Math.max(1, Math.ceil(items.length / limit));
  const safePage = Math.min(page, pageCount - 1);
  const paged = items.slice(safePage * limit, safePage * limit + limit);

  return {
    paged,
    page: safePage,
    setPage,
    limit,
    setLimit,
    total: items.length,
  };
}

export const TablePager = ({
  page,
  setPage,
  limit,
  setLimit,
  total,
}: {
  page: number;
  setPage: (p: number) => void;
  limit: number;
  setLimit: (l: number) => void;
  total: number;
}) => {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : page * limit + 1;
  const to = Math.min(total, (page + 1) * limit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-2.5 text-[11px] text-ink-500">
      <label className="flex items-center gap-1.5">
        Results per page
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-md border border-ink-200 bg-white px-1.5 py-1 text-[11px] focus:border-brand-400 focus:outline-none"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </label>
      <span className="tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => setPage(page - 1)}
          className="rounded-md border border-ink-200 px-2 py-1 font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="tabular-nums">
          Page {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => setPage(page + 1)}
          className="rounded-md border border-ink-200 px-2 py-1 font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
};
