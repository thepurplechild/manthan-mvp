export default function Footer() {
  return (
    <footer className="border-t border-manthan-saffron-200/40 mt-12">
      <div className="container mx-auto px-6 py-10 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <h3 className="font-semibold text-manthan-charcoal-800 mb-2">Company</h3>
          <ul className="space-y-1 text-manthan-charcoal-600">
            <li><a href="/about" className="hover:text-manthan-saffron-600">About</a></li>
            <li><a href="/contact" className="hover:text-manthan-saffron-600">Contact</a></li>
            <li><a href="/privacy" className="hover:text-manthan-saffron-600">Privacy</a></li>
            <li><a href="/terms" className="hover:text-manthan-saffron-600">Terms</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-manthan-charcoal-800 mb-2">Product</h3>
          <ul className="space-y-1 text-manthan-charcoal-600">
            <li><a href="/features" className="hover:text-manthan-saffron-600">Features</a></li>
            <li><a href="/pricing" className="hover:text-manthan-saffron-600">Pricing</a></li>
            <li><a href="/docs" className="hover:text-manthan-saffron-600">Docs</a></li>
            <li><a href="/changelog" className="hover:text-manthan-saffron-600">Changelog</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-manthan-charcoal-800 mb-2">Social</h3>
          <ul className="space-y-1 text-manthan-charcoal-600">
            <li><a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-manthan-saffron-600">X (Twitter)</a></li>
            <li><a href="https://www.linkedin.com" target="_blank" rel="noreferrer" className="hover:text-manthan-saffron-600">LinkedIn</a></li>
            <li><a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="hover:text-manthan-saffron-600">Instagram</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-manthan-charcoal-800 mb-2">Support</h3>
          <p className="text-manthan-charcoal-600">support@projectmanthan.com</p>
          <p className="text-manthan-charcoal-600">Hours: 10:00–18:00 IST (Mon–Fri)</p>
        </div>
      </div>
    </footer>
  );
}

