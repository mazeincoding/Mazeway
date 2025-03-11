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
import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface SettingCardContextValue {
  icon?: LucideIcon;
}

const SettingCardContext = createContext<SettingCardContextValue>({});

interface SettingCardProps extends HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function SettingCard({
  icon,
  children,
  className,
  ...props
}: SettingCardProps) {
  return (
    <SettingCardContext.Provider value={{ icon }}>
      <Card className={className} {...props}>
        {children}
      </Card>
    </SettingCardContext.Provider>
  );
}

interface SettingCardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function SettingCardHeader({
  children,
  className,
  ...props
}: SettingCardHeaderProps) {
  const { icon: Icon } = useContext(SettingCardContext);
  return (
    <>
      <CardHeader
        className={cn(
          "flex-row space-y-0 gap-4 items-center bg-accent/50 rounded-t-lg",
          className
        )}
        {...props}
      >
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

interface SettingCardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

function SettingCardTitle({
  children,
  className,
  ...props
}: SettingCardTitleProps) {
  return (
    <h1 className={cn("text-2xl font-bold", className)} {...props}>
      {children}
    </h1>
  );
}

interface SettingCardDescriptionProps
  extends HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

function SettingCardDescription({
  children,
  className,
  ...props
}: SettingCardDescriptionProps) {
  return (
    <CardDescription className={className} {...props}>
      {children}
    </CardDescription>
  );
}

interface SettingCardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function SettingCardContent({
  children,
  className,
  ...props
}: SettingCardContentProps) {
  return (
    <CardContent className={cn("pt-6", className)} {...props}>
      {children}
    </CardContent>
  );
}

interface SettingCardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function SettingCardFooter({
  children,
  className,
  ...props
}: SettingCardFooterProps) {
  return (
    <CardFooter className={className} {...props}>
      {children}
    </CardFooter>
  );
}

// Attach subcomponents to SettingCard
SettingCard.Header = SettingCardHeader;
SettingCard.Title = SettingCardTitle;
SettingCard.Description = SettingCardDescription;
SettingCard.Content = SettingCardContent;
SettingCard.Footer = SettingCardFooter;
