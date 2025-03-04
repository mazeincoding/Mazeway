"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "./ui/button";
import { UserDropdown } from "./user-dropdown";
import { FaGithub, FaTwitter } from "react-icons/fa";

interface HeaderProps {
  isInitiallyLoggedIn: boolean;
  sidebar?: React.ReactNode;
}

export function Header({ isInitiallyLoggedIn, sidebar }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 backdrop-blur-lg border-b sticky top-0 z-30 bg-background/50">
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
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Link href="https://github.com/mazeincoding/mazeway" target="_blank">
            <Button variant="ghost" size="icon">
              <FaGithub className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="https://twitter.com/mazewinther1" target="_blank">
            <Button variant="ghost" size="icon">
              <FaTwitter className="h-5 w-5" />
            </Button>
          </Link>
        </div>
        {isInitiallyLoggedIn ? (
          <UserDropdown />
        ) : (
          <Link href="/auth/login">
            <Button>Try demo</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
