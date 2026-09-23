"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error("App error caught by boundary:", error);
  }, [error]);

  const handleRetry = () => {
    if (typeof unstable_retry === "function") {
      unstable_retry();
    } else if (typeof reset === "function") {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <main className="wrapper container min-h-[70vh] flex items-center justify-center py-16">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6 p-8 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="size-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
          <AlertCircle className="size-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-serif font-bold text-[#212a3b]">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-600">
            An unexpected error occurred while loading this page. Please try again or return home.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-slate-400">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <Button
            onClick={handleRetry}
            className="flex items-center gap-2 bg-[#212a3b] hover:bg-[#3d485e] text-white"
          >
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Button
            asChild
            variant="outline"
            className="flex items-center gap-2 border-slate-300"
          >
            <Link href="/">
              <Home className="size-4" />
              Return Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
