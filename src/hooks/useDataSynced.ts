import { useEffect, useRef } from "react";

// Broadcast when a Xero→DB sync finishes, so whichever data view is open can
// re-fetch and show the fresh data. The Sync button lives in the breadcrumb,
// far from the data pages, so a window event is the simplest decoupled bridge.
const EVENT = "eazy:data-synced";

export const notifyDataSynced = (companyId: string) => {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { companyId } }));
};

/** Run `onSynced` when a sync completes for this company (or any, if no id). */
export const useDataSynced = (
  companyId: string | undefined,
  onSynced: () => void,
) => {
  const cb = useRef(onSynced);
  cb.current = onSynced;
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ companyId?: string }>).detail;
      if (!companyId || detail?.companyId === companyId) cb.current();
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [companyId]);
};
