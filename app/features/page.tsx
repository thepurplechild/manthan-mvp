export const metadata = {
  title: "Features • Manthan",
  description: "Capabilities tailored for Indian media creators.",
};

export default function FeaturesPage() {
  const features = [
    { title: 'AI Pitch Packaging', desc: 'Logline, synopsis, character bible, and market-fit in minutes.' },
    { title: 'Market Insights', desc: 'India-focused trends by region, platform patterns, and seasonal windows.' },
    { title: 'Secure by Default', desc: 'Email verification, private storage, and creator-first data policies.' },
  ];
  return (
    <section className="container mx-auto px-6 py-16">
      <h1 className="text-4xl font-heading font-bold text-manthan-charcoal-800 mb-8">Features</h1>
      <div className="grid md:grid-cols-3 gap-6">
        {features.map((f) => (
          <div key={f.title} className="card-indian p-6">
            <h3 className="font-semibold text-lg text-manthan-charcoal-800 mb-2">{f.title}</h3>
            <p className="text-manthan-charcoal-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

