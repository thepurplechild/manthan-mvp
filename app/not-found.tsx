export const metadata = {
  title: "404 • Manthan",
  description: "Page not found.",
};

export default function NotFound() {
  return (
    <section className="container mx-auto px-6 py-24 text-center">
      <h1 className="text-5xl font-heading font-bold mb-3">404</h1>
      <p className="text-manthan-charcoal-600 mb-6">We couldn’t find that page.</p>
      <a href="/" className="btn-indian">Go Home</a>
    </section>
  );
}

