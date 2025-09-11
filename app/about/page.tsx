export const metadata = {
  title: "About • Manthan",
  description: "Mission & vision of Project Manthan for Indian creators.",
};

export default function AboutPage() {
  return (
    <section className="container mx-auto px-6 py-16">
      <h1 className="text-4xl font-heading font-bold text-manthan-charcoal-800 mb-4">About Manthan</h1>
      <p className="text-manthan-charcoal-600 max-w-2xl">
        Manthan accelerates India’s storytellers by turning scripts into professional pitch packages and connecting
        them with the right buyers. Our mission is to unlock opportunity for creators across languages and regions,
        with trust, transparency, and creator-first principles.
      </p>
    </section>
  );
}

