"use client";

import { Header } from "@/components/header";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { KeyRound, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const normalizePath = (path: string) => {
    return path.replace(/\/$/, ""); // Remove trailing slash if present
  };

  const getTitle = () => {
    const normalizedPath = normalizePath(pathname);
    switch (normalizedPath) {
      case "/account/security":
        return "Security";
      case "/account":
        return "Account";
      default:
        return "Account";
    }
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen w-full">
        <Header
          isInitiallyLoggedIn={true}
          sidebar={<SidebarTrigger className="md:hidden" />}
        />
        <div className="flex flex-1 w-full">
          <SettingsSidebar />
          <div className="flex-1 px-4 md:px-8 py-10">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              <h1 className="text-2xl font-bold">{getTitle()}</h1>
              {children}
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SettingsSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const normalizePath = (path: string) => {
    return path.replace(/\/$/, "");
  };

  const items = [
    {
      title: "Account",
      href: "/account",
      icon: User,
    },
    {
      title: "Security",
      href: "/account/security",
      icon: KeyRound,
    },
  ];

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  normalizePath(pathname) === normalizePath(item.href);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href} onClick={handleLinkClick}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
