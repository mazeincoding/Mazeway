import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header isInitiallyLoggedIn={false} />
      <main className="flex-grow flex items-center justify-center flex-col gap-6 px-8 text-center">
        <div className="flex flex-col gap-3 max-w-xl mx-auto">
          <h1 className="text-4xl font-bold text-center text-pretty">
            Clerk but you own the code
          </h1>
          <p className="block text-lg text-muted-foreground text-pretty">
            Production-ready auth you can actually customize. Built with modern
            tech you already know and love. Created with security in mind.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/auth/login">
            <Button variant="secondary">Log in</Button>
          </Link>
          <Link href="/auth/signup">
            <Button>Sign up</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
