"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="site-shell section-pad pt-24">
      <h1 className="display text-5xl">Page error</h1>
      <p className="mt-4 text-mist">{error.message || "Something went wrong loading this page."}</p>
      <button type="button" className="btn btn-primary mt-6" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
