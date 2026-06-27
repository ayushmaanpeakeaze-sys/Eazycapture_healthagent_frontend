import { BatchTransaction } from "../types/audit.types";

export interface DuplicateGroup {
  key: string;
  transactions: BatchTransaction[];
}

const groupKey = (tx: BatchTransaction): string =>
  `${tx.vendor_name.trim().toLowerCase()}|${tx.date}|${Number(tx.amount).toFixed(2)}`;

export const findDuplicateGroups = (
  transactions: BatchTransaction[],
): DuplicateGroup[] => {
  const buckets = new Map<string, BatchTransaction[]>();
  for (const tx of transactions) {
    const key = groupKey(tx);
    const existing = buckets.get(key) ?? [];
    existing.push(tx);
    buckets.set(key, existing);
  }
  return Array.from(buckets.entries())
    .filter(([, txs]) => txs.length >= 2)
    .map(([key, txs]) => ({ key, transactions: txs }));
};

export const buildDuplicateIndex = (
  transactions: BatchTransaction[],
): Map<string, string> => {
  const groups = findDuplicateGroups(transactions);
  const index = new Map<string, string>();
  groups.forEach((group) => {
    group.transactions.forEach((tx) => index.set(tx.transaction_id, group.key));
  });
  return index;
};
