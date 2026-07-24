import Link from "next/link";
import { business } from "@/lib/business";

export function Footer() {
  const { brand } = business;

  return (
    <footer className="mt-20 border-t border-lavender-light bg-lavender-light/40">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="text-lg font-semibold text-gold-dark">{brand.name}</p>
            <p className="mt-2 text-sm text-text-muted">{brand.tagline}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text">Contact</p>
            <a
              href={`mailto:${brand.email}`}
              className="mt-2 block text-sm text-text-muted hover:text-gold-dark"
            >
              {brand.email}
            </a>
          </div>
          <div>
            <p className="text-sm font-medium text-text">Follow</p>
            <p className="mt-2 text-sm text-text-muted">
              Instagram: {brand.social.instagram}
            </p>
            <p className="text-sm text-text-muted">
              Facebook: {brand.social.facebook}
            </p>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-text-muted">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
