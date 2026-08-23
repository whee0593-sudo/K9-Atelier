"use client";

import Link from "next/link";

type Props = {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

export function BookServiceLink({ className, children, onClick }: Props) {
  return (
    <Link href="/book" className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
