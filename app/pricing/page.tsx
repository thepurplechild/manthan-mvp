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
    </section>
  );
}

