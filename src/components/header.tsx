"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { UserDropdown } from "./user-dropdown";

interface HeaderProps {
  isInitiallyLoggedIn: boolean;
}

export function Header({ isInitiallyLoggedIn }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-4 backdrop-blur-xl border-b sticky top-0 z-30 bg-background flex-1">
      <h1 className="text-xl mt-0.5 font-bold">
        <Link href="/">Auth</Link>
      </h1>
      {isInitiallyLoggedIn ? (
        <UserDropdown />
      ) : (
        <Link href="/auth/login">
          <Button variant="secondary">Log in</Button>
        </Link>
      )}
    </header>
  );
}
