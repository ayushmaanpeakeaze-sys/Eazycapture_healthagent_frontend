import { useNavigate } from "react-router-dom";

export const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-5xl font-semibold tracking-tight text-ink-300">404</p>
      <p className="text-sm font-semibold text-ink-800">Page not found</p>
      <p className="max-w-sm text-xs text-ink-500">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <button
        type="button"
        onClick={() => navigate("/overview")}
        className="mt-1 rounded-lg bg-brand-gradient px-4 py-2 text-xs font-semibold text-white shadow-brand transition hover:brightness-110"
      >
        Back to overview
      </button>
    </div>
  );
};
