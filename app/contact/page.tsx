export const metadata = {
  title: "Contact • Manthan",
  description: "Contact the Manthan team for support and partnerships.",
};

export default function ContactPage() {
  return (
    <section className="container mx-auto px-6 py-16 max-w-2xl">
      <h1 className="text-4xl font-heading font-bold text-manthan-charcoal-800 mb-4">Contact</h1>
      <p className="text-manthan-charcoal-600 mb-6">Write to us and we’ll get back within 1–2 business days.</p>
      <form className="space-y-4">
        <input className="input-indian w-full" placeholder="Your email" type="email" required />
        <input className="input-indian w-full" placeholder="Subject" required />
        <textarea className="input-indian w-full min-h-32" placeholder="How can we help?" />
        <button className="btn-indian" type="submit">Send</button>
      </form>
      <p className="text-sm text-manthan-charcoal-600 mt-4">Support: support@projectmanthan.com</p>
    </section>
  );
}

