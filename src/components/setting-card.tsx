import { LucideIcon } from "lucide-react";
import { GradientText } from "@/components/gradient-text";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface SettingCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SettingCard({
  icon: Icon,
  title,
  description,
  children,
  footer,
}: SettingCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row space-y-0 gap-4 items-center bg-accent/50">
        <div className="flex flex-col items-center justify-center gap-2 rounded-full bg-accent p-2 size-12">
          <Icon className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <GradientText className="text-2xl font-bold">{title}</GradientText>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
