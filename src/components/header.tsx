"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { GradientText } from "./gradient-text";

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 px-6 bg-background border-b">
      <h1 className="text-2xl font-bold">
        <Link href="/">
          <GradientText>Auth</GradientText>
        </Link>
      </h1>
      <Link href="/login">
        <Button variant="secondary">Log in</Button>
      </Link>
    </header>
  );
}
