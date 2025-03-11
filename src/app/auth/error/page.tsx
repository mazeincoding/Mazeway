"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Suspense } from "react";

interface TErrorAction {
  label: string;
  href: string;
  type?: "default" | "secondary";
}

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorTitle = searchParams.get("title") || "Something went wrong";
  const errorMessage =
    searchParams.get("message") || "An unexpected error occurred";
  const errorActions = searchParams.get("actions")
    ? JSON.parse(decodeURIComponent(searchParams.get("actions") || "[]"))
    : [{ label: "Go Home", href: "/", type: "default" }];
  const errorObject = searchParams.get("error");
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-4 py-8 md:px-8 max-w-xl mx-auto">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{errorTitle}</CardTitle>
          <CardDescription className="text-pretty text-sm">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="w-full flex flex-col gap-3">
            {errorActions.map((action: TErrorAction) => (
              <Link key={action.href} href={action.href} className="w-full">
                <Button
                  variant={action.type === "default" ? "default" : "outline"}
                  className="w-full"
                >
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
        {errorObject && (
          <CardFooter className="flex-col gap-2">
            <>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {showDetails ? "Hide error details" : "See error details"}
                <ChevronRight
                  className={`h-4 w-4 ${showDetails ? "rotate-90" : ""}`}
                />
              </button>
              {showDetails && (
                <pre className="mt-4 p-4 bg-muted rounded-lg text-left text-sm overflow-auto w-full">
                  <code>
                    {JSON.stringify(
                      {
                        error: errorObject,
                      },
                      null,
                      2
                    )}
                  </code>
                </pre>
              )}
            </>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md p-6">
            <CardHeader>
              <CardTitle className="text-2xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
