import { Component, ReactNode } from "react";

// Isolates a single insight card: if it throws (e.g. a sparse snapshot is
// missing a section), show a small fallback instead of white-screening the page.
export class CardBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <section className="flex items-center justify-center rounded-2xl border border-ink-100 bg-white p-5 text-center text-xs text-ink-400 shadow-card">
          This insight isn’t available yet.
        </section>
      );
    }
    return this.props.children;
  }
}
