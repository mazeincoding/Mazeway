"use client";

import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { LogOutIcon, MoonIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/utils/api";
import { useUser } from "@/hooks/use-auth";

interface dropdownItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "destructive";
}

export function UserDropdown() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { user, refresh: refreshUser } = useUser();

  const dropdownItems: dropdownItem[] = [
    {
      label: "Account",
      icon: <UserIcon className="h-4 w-4" />,
      onClick: () => router.push("/account"),
    },
    {
      label: theme === "light" ? "Light mode" : "Dark mode",
      icon: <MoonIcon className="h-4 w-4" />,
      onClick: () => setTheme(theme === "light" ? "dark" : "light"),
    },
    {
      label: "Log out",
      icon: <LogOutIcon className="h-4 w-4" />,
      onClick: handleSignOut,
      variant: "destructive",
    },
  ];

  async function handleSignOut() {
    try {
      await api.auth.logout();
      // No need to refresh user data after logout
      // Just redirect to home page and force a full page refresh
      window.location.href = "/";
    } catch (error) {
      toast.error("Failed to log out", {
        description:
          error instanceof Error ? error.message : "Please try again later",
      });
    }
  }

  function getFirstLetter(text: string) {
    return text.charAt(0);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarImage
            src={user?.avatar_url}
            alt="User avatar"
            className="object-cover"
          />
          <AvatarFallback>{getFirstLetter(user?.name || "U")}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {dropdownItems.map((item, index) => (
          <DropdownMenuItem
            key={index}
            onClick={item.onClick}
            variant={item.variant}
          >
            <div className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
