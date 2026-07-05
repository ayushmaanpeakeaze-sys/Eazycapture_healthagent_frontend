import { useEffect, useRef } from "react";

const EVENT = "eazy:data-synced";

export const notifyDataSynced = (companyId: string) => {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { companyId } }));
};

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
