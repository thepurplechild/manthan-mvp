export const metadata = {
  title: "Contact • Manthan",
  description: "Contact the Manthan team for support and partnerships.",
};

export default function ContactPage() {
  return (
    <section className="container mx-auto px-6 py-16 max-w-2xl">
      <h1 className="text-4xl font-heading font-bold text-manthan-charcoal-800 mb-4">Contact</h1>
      <p className="text-manthan-charcoal-600 mb-6">Write to us and we’ll get back within 1–2 business days. Support hours: 10:00–18:00 IST (Mon–Fri).</p>
      <form className="space-y-4">
        <input className="input-indian w-full" placeholder="Your email" type="email" required />
        <input className="input-indian w-full" placeholder="Subject" required />
        <textarea className="input-indian w-full min-h-32" placeholder="How can we help?" />
        <button className="btn-indian" type="submit">Send</button>
      </form>
      <div className="mt-6 text-sm text-manthan-charcoal-600">
        <p>Support: support@projectmanthan.com • +91-00000-00000</p>
        <p>Address: Mumbai (placeholder)</p>
      </div>
    </section>
  );
}
