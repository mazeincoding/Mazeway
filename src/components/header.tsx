"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { UserDropdown } from "./user-dropdown";

interface HeaderProps {
  isInitiallyLoggedIn: boolean;
  sidebar?: React.ReactNode;
}

export function Header({ isInitiallyLoggedIn, sidebar }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 backdrop-blur-xl border-b sticky top-0 z-30 bg-background">
      <div className="flex items-center gap-2">
        {sidebar}
        <h1 className="text-xl mt-0.5 font-bold">
          <Link href="/">Auth</Link>
        </h1>
      </div>
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
