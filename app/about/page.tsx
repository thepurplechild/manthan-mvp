export const metadata = {
  title: "About • Manthan",
  description: "Mission & vision of Project Manthan for Indian creators.",
};

export default function AboutPage() {
  return (
    <section className="container mx-auto px-6 py-16">
      <h1 className="text-4xl font-heading font-bold text-manthan-charcoal-800 mb-4">About Manthan</h1>
      <div className="grid md:grid-cols-2 gap-8 text-manthan-charcoal-600">
        <div>
          <p className="mb-4">Manthan accelerates India’s storytellers by turning scripts into professional pitch packages and connecting them with the right buyers.</p>
          <p className="mb-4">Our mission is opportunity for every creator, across languages and regions, with trust, transparency, and creator-first principles.</p>
          <ul className="list-disc list-inside">
            <li>Creator-first IP protection</li>
            <li>India-focused insights and distribution paths</li>
            <li>AI assistance built for films and series</li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold text-manthan-charcoal-800 mb-2">Team & Values</h2>
          <p className="mb-2">We’re a small team of builders and producers passionate about Indian media.</p>
          <p>Values: integrity, inclusivity, and results for creators.</p>
        </div>
      </div>
    </section>
  );
}
