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
import { KeyRound, User, DatabaseIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTH_CONFIG } from "@/config/auth";

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen w-full">
        <Header
          isInitiallyLoggedIn={true}
          sidebar={<SidebarTrigger className="md:hidden" />}
        />
        <div className="flex flex-1 w-full">
          <SettingsSidebar />
          <div className="flex-1 px-6 md:px-8 py-7 md:py-8">
            <div className="max-w-4xl mx-auto">{children}</div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SettingsSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

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

  // Only add data section if data exports are enabled
  if (AUTH_CONFIG.dataExport.enabled) {
    items.push({
      title: "Data",
      href: "/account/data",
      icon: DatabaseIcon,
    });
  }

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
                  pathname === item.href || pathname === `${item.href}/`;

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
