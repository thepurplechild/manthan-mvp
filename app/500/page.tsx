export const metadata = {
  title: "Error • Manthan",
  description: "An unexpected error occurred.",
};

export default function FiveHundred() {
  return (
    <section className="container mx-auto px-6 py-24 text-center">
      <h1 className="text-4xl font-heading font-bold mb-3">Something went wrong</h1>
      <p className="text-manthan-charcoal-600 mb-6">Please try again or return home.</p>
      <a href="/" className="btn-indian">Go Home</a>
    </section>
  );
}

