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
            src="https://res.cloudinary.com/dzjgehvid/image/upload/v1741404870/text-logo-black-demo_lc3pn4.png"
            alt="Logo"
            width={810}
            height={121}
            priority
            className="dark:invert w-full h-7"
          />
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {!isInitiallyLoggedIn && (
          <div className="flex items-center gap-1">
            <Link
              href="https://github.com/mazeincoding/mazeway"
              target="_blank"
            >
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
        )}
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
