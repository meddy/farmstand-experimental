import { type ReactNode } from "react";
import { V2BackLink } from "@/v2/components/layout/V2BackLink";

interface V2ChildPageProps {
  title: string;
  children?: ReactNode;
}

export function V2ChildPage({ title, children }: V2ChildPageProps) {
  return (
    <div>
      <V2BackLink />
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}
