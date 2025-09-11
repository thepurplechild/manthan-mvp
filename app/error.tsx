"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="container mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl font-heading font-bold mb-3">Unexpected error</h2>
          <p className="text-manthan-charcoal-600 mb-6">{error.message}</p>
          <button className="btn-royal" onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}

