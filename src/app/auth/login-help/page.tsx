"use client";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FaKey } from "react-icons/fa";
import { useSearchParams } from "next/navigation";

interface HelpOption {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

export default function LoginHelp() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const helpOptions: HelpOption[] = [
    {
      icon: <FaKey className="flex-shrink-0" />,
      title: "Reset your password",
      description: "We'll send you a link to create a new password",
      href: `/auth/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`,
    },
  ];

  return (
    <div className="flex flex-col">
      <Header isInitiallyLoggedIn={false} />
      <main className="flex-grow flex justify-center gap-5 px-8 py-10 mt-6">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold">Need help logging in?</h1>
              <p className="text-foreground/35">
                We'll make it easy. What do you need help with?
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {helpOptions.map((option) => (
              <Link key={option.href} href={option.href}>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-4 px-6"
                >
                  <div className="flex gap-4 items-center">
                    {option.icon}
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{option.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </div>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
