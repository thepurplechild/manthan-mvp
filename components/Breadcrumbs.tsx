"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items?: Item[] }) {
  const pathname = usePathname();
  let derived: Item[] | null = null;
  if (!items && pathname) {
    const segs = pathname.split('/').filter(Boolean);
    let acc = '';
    derived = segs.map((s, i) => {
      acc += '/' + s;
      const label = decodeURIComponent(s).replace(/\-/g, ' ');
      return i < segs.length - 1 ? { label, href: acc } : { label };
    });
    if (derived.length === 0) derived = [{ label: 'home', href: '/' }];
  }
  const list = items || derived || [];
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-manthan-charcoal-600 mb-4">
      <ol className="flex flex-wrap items-center gap-1">
        {list.map((it, idx) => (
          <li key={idx} className="flex items-center gap-1">
            {it.href ? (
              <Link href={it.href} className="hover:text-manthan-saffron-600">
                {it.label}
              </Link>
            ) : (
              <span className="text-manthan-charcoal-800">{it.label}</span>
            )}
            {idx < list.length - 1 && <span className="opacity-60">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
