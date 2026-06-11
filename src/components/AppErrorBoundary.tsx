import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

const clearAuthStorage = () => {
  const clearStore = (store: Storage) => {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (!key) continue;
      if (
        key === "supabase.auth.token" ||
        (key.startsWith("sb-") && (key.includes("-auth-token") || key.includes("-code-verifier"))) ||
        key.startsWith("taclink_free_waiver_ack:") ||
        key === "taclink_last_activity_at"
      ) {
        store.removeItem(key);
      }
    }
  };

  try { clearStore(localStorage); } catch { /* ignore */ }
  try { clearStore(sessionStorage); } catch { /* ignore */ }
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[app] render crashed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground grid place-items-center px-6 py-10">
        <div className="w-full max-w-sm border border-border bg-card p-6 text-center space-y-4 rounded-md shadow-lg">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 grid place-items-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black">TacLink hit a bad session</h1>
            <p className="text-sm text-muted-foreground">
              Refresh the app. If it comes back here, clear the stuck sign-in and start again.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} className="w-full">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearAuthStorage();
                window.location.assign("/auth/signin");
              }}
              className="w-full"
            >
              <LogOut className="h-4 w-4" /> Clear sign-in
            </Button>
          </div>
        </div>
      </main>
    );
  }
}