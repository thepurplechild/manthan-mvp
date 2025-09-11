"use client";

import Link from "next/link";

export default function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-manthan-charcoal-600 mb-4">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-center gap-1">
            {it.href ? (
              <Link href={it.href} className="hover:text-manthan-saffron-600">
                {it.label}
              </Link>
            ) : (
              <span className="text-manthan-charcoal-800">{it.label}</span>
            )}
            {idx < items.length - 1 && <span className="opacity-60">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

