import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/gradient-text";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header isInitiallyLoggedIn={false} />
      <main className="flex-grow flex items-center justify-center flex-col gap-5 px-8 text-center">
        <div className="flex flex-col gap-2 max-w-xl mx-auto">
          <h1 className="text-4xl font-bold text-center text-pretty">
            <GradientText>Building authentication sucks.</GradientText>
          </h1>
          <p className="block text-lg text-foreground/35 text-pretty">
            Well, not anymore. The best auth is the one you don't have to build.
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
