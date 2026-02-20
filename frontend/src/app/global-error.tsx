"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="mx-auto max-w-md space-y-4 px-4 text-center">
          <h2 className="text-2xl font-bold text-destructive">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            A critical error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
