export const metadata = {
  title: "Unauthorized • Manthan",
  description: "You don’t have access to this resource.",
};

export default function Unauthorized() {
  return (
    <section className="container mx-auto px-6 py-24 text-center">
      <h1 className="text-4xl font-heading font-bold mb-3">Unauthorized</h1>
      <p className="text-manthan-charcoal-600 mb-6">Please sign in or contact support if you believe this is an error.</p>
      <a href="/login" className="btn-royal">Sign in</a>
    </section>
  );
}

