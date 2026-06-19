import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function V2BackLink() {
  return (
    <Link
      to="/v2"
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back
    </Link>
  );
}
