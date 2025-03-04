import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header isInitiallyLoggedIn={false} />
      <main className="flex-grow flex items-center justify-center flex-col gap-6 px-8 py-16 text-center">
        <div className="flex items-center flex-col gap-5 max-w-2xl mx-auto">
          <Badge variant="outline" className="w-fit text-sm font-normal">
            Demo
          </Badge>
          <h1 className="text-5xl font-semibold text-center text-pretty">
            Mazeway Demo
          </h1>
          <p className="block text-lg text-muted-foreground text-pretty">
            Drop in production-ready auth code with everything apps need
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/auth/signup">
            <Button size="lg" className="text-base">
              Try demo
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
