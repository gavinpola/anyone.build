import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; title: string };
type State = { error: Error | null };

/** One broken block must never take down the wall. */
export class BlockBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-5">
          <p className="placard smallcaps text-bad">this block crashed</p>
          <p className="mt-1 font-display text-lg">{this.props.title}</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-bad-soft p-3 font-mono text-[11px] text-bad">
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
