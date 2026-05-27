import { Link } from "react-router-dom";
import { Terminal, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        {/* Terminal Icon */}
        <div className="w-14 h-14 rounded-xl bg-card border border-border flex items-center justify-center mx-auto">
          <Terminal className="w-7 h-7 text-primary" />
        </div>

        {/* 404 Block */}
        <div className="bg-card border border-border rounded-xl p-8 text-left space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-status-critical/70" />
            <div className="w-3 h-3 rounded-full bg-status-warning/70" />
            <div className="w-3 h-3 rounded-full bg-status-healthy/70" />
            <span className="ml-2 text-xs text-muted-foreground font-mono">dev-portal — bash</span>
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            <span className="text-primary">$</span> curl {window.location.pathname}
          </p>
          <p className="font-mono text-status-critical text-sm">
            HTTP 404 Not Found
          </p>
          <p className="font-mono text-muted-foreground text-sm">
            {`{ "error": "page not found" }`}
          </p>
          <p className="font-mono text-sm text-muted-foreground">
            <span className="text-primary">$</span>{" "}
            <span className="animate-pulse">_</span>
          </p>
        </div>

        {/* Message */}
        <div>
          <h1 className="text-3xl font-bold text-foreground font-mono">404</h1>
          <p className="text-muted-foreground mt-1">This page does not exist</p>
        </div>

        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
