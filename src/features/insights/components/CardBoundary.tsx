import { Component, ReactNode } from "react";

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
        <section className="flex items-center justify-center rounded-2xl border border-ink-100 bg-surface p-5 text-center text-xs text-ink-400 shadow-card">
          This insight isn’t available yet.
        </section>
      );
    }
    return this.props.children;
  }
}
