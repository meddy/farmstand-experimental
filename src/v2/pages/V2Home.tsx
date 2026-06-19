import { NavLink } from "react-router-dom";
import { v2MenuItems } from "@/v2/nav";

export function V2Home() {
  return (
    <ul className="list-disc space-y-4 pl-6 text-lg">
      {v2MenuItems.map(({ to, label }) => (
        <li key={to}>
          <NavLink
            to={to}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
