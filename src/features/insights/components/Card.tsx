import { ReactNode } from "react";

export const HelpDot = ({ text }: { text: string }) => (
  <span
    title={text}
    className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-ink-100 text-[9px] font-bold text-ink-400"
  >
    ?
  </span>
);

export const Card = ({
  title,
  help,
  right,
  children,
}: {
  title: string;
  help?: string;
  right?: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex flex-col rounded-2xl border border-ink-100 bg-surface p-5 shadow-card">
    <header className="mb-3 flex items-center gap-2">
      <h3 className="text-base font-semibold tracking-tight text-brand-700">
        {title}
      </h3>
      {help && <HelpDot text={help} />}
      {right && <div className="ml-auto">{right}</div>}
    </header>
    <div className="flex flex-1 flex-col">{children}</div>
  </section>
);
