"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/projects/new", label: "Create Project" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-full md:w-56 shrink-0">
      <nav aria-label="Sidebar" className="space-y-1">
        {links.map((l) => {
          const active = pathname?.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-manthan-royal-500 ${active ? 'bg-manthan-royal-50 text-manthan-royal-700' : 'text-manthan-charcoal-700 hover:bg-manthan-saffron-50 hover:text-manthan-saffron-700'}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

