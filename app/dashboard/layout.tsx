import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { accounts } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../api/_lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/vendors", label: "Vendors" },
  { href: "/dashboard/reviews", label: "Reviews" },
  { href: "/dashboard/settings", label: "Settings" }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthenticatedAccount();
  if (!auth) redirect("/login");

  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, auth.accountId))
    .limit(1);

  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar">
        <header className="sidebar-header">
          <p className="sidebar-kicker">COI tracker</p>
          <p className="account-name">{account?.name ?? "Your account"}</p>
        </header>
        <nav aria-label="Dashboard">
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main id="main-content" className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
