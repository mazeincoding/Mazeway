"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { UserDropdown } from "./user-dropdown";

interface HeaderProps {
  isInitiallyLoggedIn: boolean;
}

export function Header({ isInitiallyLoggedIn }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 px-6 backdrop-blur-xl border-b sticky top-0 z-10">
      <h1 className="text-2xl font-bold">
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
