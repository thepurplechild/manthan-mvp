export const metadata = {
  title: "Pricing • Manthan",
  description: "Simple ₹-denominated pricing for creators and teams.",
};

export default function PricingPage() {
  const tiers = [
    { name: 'Starter', price: '₹0', perks: ['Basic packaging', 'Email support'] },
    { name: 'Pro', price: '₹999/mo', perks: ['Full pipeline', 'Priority support', 'Insights'] },
    { name: 'Studio', price: '₹4,999/mo', perks: ['Team workflows', 'Advanced analytics'] },
  ];
  return (
    <section className="container mx-auto px-6 py-16">
      <h1 className="text-4xl font-heading font-bold text-manthan-charcoal-800 mb-8">Pricing</h1>
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((t) => (
          <div key={t.name} className="card-premium p-6">
            <h3 className="text-xl font-semibold text-manthan-charcoal-800">{t.name}</h3>
            <p className="text-3xl font-heading my-3">{t.price}</p>
            <ul className="text-manthan-charcoal-600 space-y-1">
              {t.perks.map((p) => (<li key={p}>• {p}</li>))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-semibold text-manthan-charcoal-800 mb-2">FAQ</h2>
        <div className="card-indian p-4 mb-2">
          <p className="font-semibold text-manthan-charcoal-800">Is there a free tier?</p>
          <p className="text-manthan-charcoal-600">Yes, Starter is free for individuals getting started.</p>
        </div>
        <div className="card-indian p-4">
          <p className="font-semibold text-manthan-charcoal-800">Do you support teams?</p>
          <p className="text-manthan-charcoal-600">The Studio plan supports teams and shared workspaces.</p>
        </div>
      </div>
    </section>
  );
}
