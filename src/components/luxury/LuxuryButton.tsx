import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function LuxuryButton({
  href,
  children,
  variant = "primary",
  className = "",
}: Props) {
  const base =
    "inline-flex min-h-[52px] items-center justify-center px-8 text-[12px] font-medium uppercase tracking-[0.16em] transition duration-500 ease-out";
  const styles =
    variant === "primary"
      ? "bg-deep-lavender text-ivory hover:bg-ink"
      : "border border-champagne bg-transparent text-ink hover:border-ink";

  return (
    <Link href={href} className={`${base} ${styles} rounded-sm ${className}`}>
      {children}
    </Link>
  );
}
