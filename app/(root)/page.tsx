import React from "react";
import HeroSection from "@/components/HeroSection";
import BookCard from "@/components/BookCard";
import { getAllBooks } from "@/lib/actions/book.actions";
import Search from "@/components/Search";
import Link from "next/link";

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) => {
  const { query } = await searchParams;

  const bookResults = await getAllBooks(query);
  const books = bookResults.success ? (bookResults.data ?? []) : [];

  return (
    <main className="wrapper container">
      <HeroSection />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
        <h2 className="text-3xl font-serif font-bold text-[#212a3b]">
          Recent Books
        </h2>
        <Search />
      </div>

      {books.length > 0 ? (
        <div className="library-books-grid">
          {books.map((book) => (
            <BookCard
              key={book._id}
              title={book.title}
              author={book.author}
              coverURL={book.coverURL}
              slug={book.slug}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white/50 border border-dashed border-slate-300 rounded-2xl p-8 mb-12">
          <p className="text-lg font-medium text-slate-700 mb-2">
            {query
              ? `No books found matching "${query}"`
              : "No books in the library yet"}
          </p>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            {query
              ? "Try adjusting your search terms or clear the search to view all books."
              : "Upload your first book in PDF format to start interactive voice conversations."}
          </p>
          <Link
            href="/books/new"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium bg-[#212a3b] hover:bg-[#3d485e] text-white transition-colors"
          >
            Upload a Book
          </Link>
        </div>
      )}
    </main>
  );
};

export default Page;
