import { DirectorsLoansResponse } from "../../../types/insights.types";
import { Card } from "../components/Card";
import { gbp } from "../lib/format";

export const DirectorsLoansCard = ({ data }: { data: DirectorsLoansResponse }) => {
  const accounts = data.accounts ?? [];
  const owesCompany = accounts.filter((a) => a.overdrawn); // director owes co.
  const owedByCompany = accounts.filter((a) => !a.overdrawn);
  const empty = !data.detected || accounts.length === 0;

  return (
    <Card title="Directors’ Loan Accounts" help="Auto-detected by account name.">
      {empty ? (
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-sm text-ink-600">No director’s-loan account mapped.</p>
          <p className="mt-1 text-[11px] text-ink-500">{data.note}</p>
          <span className="mt-3 w-fit rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-400 ring-1 ring-ink-200">
            Manual mapping coming soon
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <DlaGroup
            title="Director(s) owe the company"
            danger
            accounts={owesCompany}
          />
          <DlaGroup
            title="Company owes director(s)"
            accounts={owedByCompany}
          />
          <p className="text-[10px] italic text-ink-400">{data.note}</p>
        </div>
      )}
    </Card>
  );
};

const DlaGroup = ({
  title,
  accounts,
  danger,
}: {
  title: string;
  accounts: DirectorsLoansResponse["accounts"];
  danger?: boolean;
}) => (
  <div>
    <p className="text-[11px] font-medium text-ink-600">{title}</p>
    {accounts.length === 0 ? (
      <p className="text-[11px] text-ink-400">None.</p>
    ) : (
      <ul className="mt-1 space-y-1">
        {accounts.map((a) => (
          <li
            key={a.code || a.account}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="truncate text-ink-800">
              {a.account}
              {a.code && (
                <span className="ml-1 font-mono text-[10px] text-ink-400">
                  {a.code}
                </span>
              )}
            </span>
            <span
              className={[
                "shrink-0 font-semibold tabular-nums",
                danger ? "text-rose-600" : "text-ink-900",
              ].join(" ")}
            >
              {gbp(a.balance)}
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);
