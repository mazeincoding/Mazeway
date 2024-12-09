"use client";

import Link from "next/link";
import { Button } from "./ui/button";

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 px-6 bg-background border-b">
      <h1 className="text-2xl font-bold">
        <Link
          href="/"
          className="bg-gradient-to-t from-foreground/50 to-foreground bg-clip-text text-transparent"
        >
          Auth
        </Link>
      </h1>
      <Link href="/login">
        <Button variant="secondary">Log in</Button>
      </Link>
    </header>
  );
}
