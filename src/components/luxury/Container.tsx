import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer";
  id?: string;
};

export function Container({
  children,
  className = "",
  as: Tag = "div",
  id,
}: Props) {
  return (
    <Tag
      id={id}
      className={`mx-auto w-full max-w-[1240px] px-5 md:px-12 xl:px-20 ${className}`}
    >
      {children}
    </Tag>
  );
}
