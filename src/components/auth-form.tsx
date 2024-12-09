"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FaGoogle } from "react-icons/fa";
import Link from "next/link";

interface AuthFormProps {
  type: "login" | "signup";
}

export function AuthForm({ type }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement auth logic
    console.log({ email, password });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-2xl font-bold bg-gradient-to-t from-foreground/50 to-foreground bg-clip-text text-transparent">
            {type === "login" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription className="text-foreground/35">
            {type === "login"
              ? "Enter your credentials to continue"
              : "Enter your details below to get started"}
          </CardDescription>
        </div>
        <SocialButtons />
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            {type === "login" ? "Log in" : "Create account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t p-5">
        <p className="text-sm text-foreground/35 flex gap-1">
          {type === "login" ? (
            <>
              Don't have an account?{" "}
              <Link href="/signup" className="text-foreground hover:underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-foreground hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </CardFooter>
    </Card>
  );
}

export function SocialButtons() {
  return (
    <div className="flex gap-2">
      <Button variant="outline" className="w-full">
        <FaGoogle className="w-4 h-4" />
        Continue with Google
      </Button>
    </div>
  );
}
