import { useEffect, useState } from "react";

import {
  ConnectedCompany,
  fetchConnectedCompanies,
} from "../services/audit.service";

const SELECTED_STORAGE_KEY = "eazy.company.id";

export interface UseSelectedCompany {
  companies: ConnectedCompany[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  selected: ConnectedCompany | null;
  loading: boolean;
}

export function useSelectedCompany(): UseSelectedCompany {
  const [companies, setCompanies] = useState<ConnectedCompany[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setSelectedId = (id: string) => {
    setSelectedIdState(id);
    window.localStorage.setItem(SELECTED_STORAGE_KEY, id);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchConnectedCompanies()
      .then((list) => {
        if (!active) return;
        setCompanies(list);
        if (list.length === 0) {
          setSelectedIdState(null);
          return;
        }
        const remembered = window.localStorage.getItem(SELECTED_STORAGE_KEY);
        const initial =
          (remembered && list.find((c) => c.id === remembered)?.id) ||
          list[0].id;
        setSelectedIdState(initial);
        window.localStorage.setItem(SELECTED_STORAGE_KEY, initial);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected =
    companies.find((c) => c.id === selectedId) ?? null;

  return { companies, selectedId, setSelectedId, selected, loading };
}
