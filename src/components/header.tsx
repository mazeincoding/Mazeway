"use client";

import Link from "next/link";
import Image from "next/image";
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
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="https://rqsfebcljeizuojtkabi.supabase.co/storage/v1/object/public/logo/Frame%2038.png"
            alt="Logo"
            width={135}
            height={36}
            priority
            className="dark:invert"
          />
        </Link>
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
