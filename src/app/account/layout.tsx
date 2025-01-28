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
} from "@/components/ui/sidebar";
import { KeyRound, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col flex-grow">
          <Header isInitiallyLoggedIn={true} />
          <div className="flex-grow max-w-4xl w-full mx-auto px-8 py-12">
            {children}
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}

function AppSidebar() {
  const pathname = usePathname();

  const items = [
    {
      title: "Basic information",
      href: "/account",
      icon: User,
    },
    {
      title: "Security",
      href: "/account/security",
      icon: KeyRound,
    },
  ];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  pathname === item.href || pathname === `${item.href}/`;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
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
