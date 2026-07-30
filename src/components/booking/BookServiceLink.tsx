"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isCustomerLoggedIn } from "@/lib/customer-session";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function BookServiceLink({ className, children }: Props) {
  const [href, setHref] = useState("/login?next=/book");

  useEffect(() => {
    if (isCustomerLoggedIn()) setHref("/book");
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
