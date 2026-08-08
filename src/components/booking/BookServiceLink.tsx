"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isCustomerLoggedIn } from "@/lib/customer-session";

type Props = {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

export function BookServiceLink({ className, children, onClick }: Props) {
  const [href, setHref] = useState("/login?next=/book");

  useEffect(() => {
    if (isCustomerLoggedIn()) setHref("/book");
  }, []);

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
