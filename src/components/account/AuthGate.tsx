"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "@/lib/account";
import { loginPath } from "@/lib/next-path";

/**
 * Pages need a signed-in user (the proxy already redirects visitors with no
 * session cookie). This covers a cookie that turns out to be invalid or a
 * sign-out in another tab: the page hides and sends you to sign in.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAccount();
  const pathname = usePathname();
  const router = useRouter();
  const blocked = status === "guest" && pathname !== "/login";

  useEffect(() => {
    if (blocked) router.replace(loginPath(pathname + window.location.search));
  }, [blocked, pathname, router]);

  return blocked ? null : children;
}
