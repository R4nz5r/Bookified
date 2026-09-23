import Link from "next/link";
import { BookOpen, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="wrapper container min-h-[70vh] flex items-center justify-center py-16">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6 p-8 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center text-[#212a3b]">
          <BookOpen className="size-8" />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-semibold tracking-wider uppercase text-slate-500">
            404 Error
          </span>
          <h1 className="text-3xl font-serif font-bold text-[#212a3b]">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-600">
            The book or page you are looking for does not exist, has been removed, or is temporarily unavailable.
          </p>
        </div>

        <Button
          asChild
          className="flex items-center gap-2 bg-[#212a3b] hover:bg-[#3d485e] text-white"
        >
          <Link href="/">
            <Home className="size-4" />
            Back to Library
          </Link>
        </Button>
      </div>
    </main>
  );
}
