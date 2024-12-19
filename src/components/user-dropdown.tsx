"use client";

import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { LogOutIcon, MoonIcon, SunIcon, UserIcon } from "lucide-react";
import { useUserStore } from "@/store/user-store";

interface dropdownItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "destructive";
}

export function UserDropdown() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { user, logout } = useUserStore();

  const dropdownItems: dropdownItem[] = [
    {
      label: "Account",
      icon: <UserIcon className="h-4 w-4" />,
      onClick: () => router.push("/account"),
    },
    {
      label: "Dark mode",
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
    logout();
    router.push("/");
  }

  function getFirstLetter(text: string) {
    return text.charAt(0);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarImage src={user?.avatar_url} alt="User avatar" />
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
