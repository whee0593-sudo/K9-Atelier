import type { ReactNode } from "react";
import { Container } from "./Container";
import { Eyebrow } from "./Eyebrow";

type Props = {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PageShell({
  eyebrow,
  title,
  intro,
  children,
  className = "",
}: Props) {
  return (
    <div className={`py-14 md:py-20 ${className}`}>
      <Container>
        <header className="mx-auto max-w-3xl text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="font-display mt-5 text-[2.5rem] leading-[1.08] font-medium text-ink md:text-5xl">
            {title}
          </h1>
          {intro && (
            <div className="font-body mx-auto mt-6 max-w-2xl text-base leading-relaxed text-taupe md:text-[17px]">
              {intro}
            </div>
          )}
        </header>
        <div className="mt-14">{children}</div>
      </Container>
    </div>
  );
}
