"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Menu } from "lucide-react";

function useAuth() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getUser().then(({ data }) => setUser(data.user)).catch(() => {});
  }, []);
  return user;
}

export default function NavBar() {
  const user = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const publicLinks = [
    { href: "/", label: "Home" },
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  const authedLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/projects", label: "Projects" },
    { href: "/profile", label: "Profile" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="nav-glass sticky top-0 z-50 border-b border-manthan-saffron-200/20" aria-label="Primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center space-x-3" aria-label="Manthan home">
            <div className="w-9 h-9 gradient-saffron rounded-xl flex items-center justify-center shadow-indian">
              <span className="text-white font-bold text-lg font-heading">म</span>
            </div>
            <span className="font-heading font-bold text-manthan-charcoal-800">Manthan</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {publicLinks.map((l) => (
              <Link key={l.href} href={l.href} className={`text-sm font-medium hover:text-manthan-saffron-600 transition-colors ${pathname === l.href ? 'text-manthan-saffron-600' : 'text-manthan-charcoal-700'}`}>{l.label}</Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {!user ? (
              <>
                <Link href="/login" className="text-sm font-medium hover:text-manthan-royal-600">Login</Link>
                <Link href="/signup" className="btn-indian text-sm py-2">Sign Up</Link>
              </>
            ) : (
              <>
                {authedLinks.map((l) => (
                  <Link key={l.href} href={l.href} className={`text-sm font-medium hover:text-manthan-royal-600 ${pathname?.startsWith(l.href) ? 'text-manthan-royal-600' : 'text-manthan-charcoal-700'}`}>{l.label}</Link>
                ))}
                <form action="/auth/signout" method="post">
                  <button type="submit" className="text-sm font-medium text-manthan-charcoal-700 hover:text-manthan-coral-600">Logout</button>
                </form>
              </>
            )}
          </div>

          <button aria-label="Open menu" className="md:hidden p-2 rounded-lg hover:bg-manthan-saffron-50" onClick={() => setOpen(!open)}>
            <Menu className="w-5 h-5 text-manthan-charcoal-800" />
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-manthan-saffron-200/20 bg-white/90 backdrop-blur">
          <div className="px-4 py-3 flex flex-col gap-3">
            {publicLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-manthan-charcoal-800 hover:text-manthan-saffron-600">{l.label}</Link>
            ))}
            {!user ? (
              <div className="flex gap-3">
                <Link href="/login" onClick={() => setOpen(false)} className="btn-royal text-sm py-2">Login</Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="btn-indian text-sm py-2">Sign Up</Link>
              </div>
            ) : (
              <>
                {authedLinks.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-manthan-charcoal-800 hover:text-manthan-royal-600">{l.label}</Link>
                ))}
                <form action="/auth/signout" method="post">
                  <button type="submit" className="text-left text-manthan-charcoal-800 hover:text-manthan-coral-600">Logout</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

