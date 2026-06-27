interface InvoiceViewerProps {
  documentUrl?: string | null;
  vendorName?: string;
  invoiceNumber?: string;
}

export const InvoiceViewer = ({
  documentUrl,
  vendorName,
  invoiceNumber,
}: InvoiceViewerProps) => {
  if (documentUrl) {
    return (
      <iframe
        title="Invoice PDF"
        src={documentUrl}
        className="h-full w-full rounded-xl border border-slate-200 bg-white"
      />
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-dashed border-slate-300 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#0052cc]/10 text-[#0052cc]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm7 1.5L18.5 9H14a1 1 0 0 1-1-1V3.5Z" />
            </svg>
          </span>
          <div className="text-xs font-medium text-slate-700">
            Invoice Preview
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          PDF
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 py-10">
        <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Vendor
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {vendorName?.trim() ? vendorName : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Invoice #
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {invoiceNumber?.trim() ? invoiceNumber : "—"}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-2 rounded bg-slate-100"
                style={{ width: `${90 - i * 8}%` }}
              />
            ))}
          </div>
          <div className="mt-6 border-t border-dashed border-slate-200 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Total Due</span>
              <span className="h-3 w-20 rounded bg-slate-200" />
            </div>
          </div>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Drop a PDF or wait for the next held document.
        </p>
      </div>
    </div>
  );
};
