import { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createContext, useContext } from "react";

interface SettingCardContextValue {
  icon?: LucideIcon;
}

const SettingCardContext = createContext<SettingCardContextValue>({});

interface SettingCardProps {
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function SettingCard({ icon, children }: SettingCardProps) {
  return (
    <SettingCardContext.Provider value={{ icon }}>
      <Card>{children}</Card>
    </SettingCardContext.Provider>
  );
}

interface SettingCardHeaderProps {
  children: React.ReactNode;
}

function SettingCardHeader({ children }: SettingCardHeaderProps) {
  const { icon: Icon } = useContext(SettingCardContext);
  return (
    <>
      <CardHeader className="flex-row space-y-0 gap-4 items-center bg-accent/50">
        {Icon && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-full bg-accent p-2 size-12">
            <Icon className="size-6" />
          </div>
        )}
        <div className="flex flex-col gap-1">{children}</div>
      </CardHeader>
      <Separator />
    </>
  );
}

interface SettingCardTitleProps {
  children: React.ReactNode;
}

function SettingCardTitle({ children }: SettingCardTitleProps) {
  return <h1 className="text-2xl font-bold">{children}</h1>;
}

interface SettingCardDescriptionProps {
  children: React.ReactNode;
}

function SettingCardDescription({ children }: SettingCardDescriptionProps) {
  return <CardDescription>{children}</CardDescription>;
}

interface SettingCardContentProps {
  children: React.ReactNode;
}

function SettingCardContent({ children }: SettingCardContentProps) {
  return <CardContent className="pt-6">{children}</CardContent>;
}

interface SettingCardFooterProps {
  children: React.ReactNode;
}

function SettingCardFooter({ children }: SettingCardFooterProps) {
  return <CardFooter>{children}</CardFooter>;
}
// Attach subcomponents to SettingCard
SettingCard.Header = SettingCardHeader;
SettingCard.Title = SettingCardTitle;
SettingCard.Description = SettingCardDescription;
SettingCard.Content = SettingCardContent;
SettingCard.Footer = SettingCardFooter;
