"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/user-store";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function Account() {
  const { user } = useUserStore();
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full pt-10">
        <Loader2 className="w-10 h-10 flex-shrink-0 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Profile />
      <Separator />
      <SettingsItem
        title="Name"
        description={user.name}
        isEditing={editingName}
        setIsEditing={setEditingName}
      />
      <SettingsItem
        title="Email"
        description={user.email}
        isEditing={editingEmail}
        setIsEditing={setEditingEmail}
      />
      <Separator />
      <SettingsItem
        title="Delete account"
        description="All your data will be lost and you will not be able to get it back after 30 days. Please be certain."
      />
    </div>
  );
}

function SettingsItem({
  title,
  description,
  onChange,
  onSave,
  isEditing,
  setIsEditing,
}: {
  title: string;
  description: string;
  onChange: (description: string) => void;
  onSave: (description: string) => void;
  isEditing?: boolean;
  setIsEditing?: (isEditing: boolean) => void;
}) {
  function handleChange(value: string) {
    onChange(value);
  }

  function handleSave() {
    onSave(description);
    setIsEditing?.(false);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        isEditing && "flex-col items-start"
      )}
    >
      <div className="flex flex-col gap-1 w-full">
        <h3 className="text-lg font-medium">{title}</h3>
        {isEditing ? (
          <Input
            type="text"
            value={description}
            className="w-full"
            onChange={(e) => handleChange(e.target.value)}
          />
        ) : (
          <p className="text-base text-muted-foreground">{description}</p>
        )}
      </div>
      <Button
        variant={isEditing ? "default" : "secondary"}
        onClick={() => (isEditing ? handleSave() : setIsEditing?.(true))}
        className="transition-none"
      >
        {isEditing ? "Save" : "Edit"}
      </Button>
    </div>
  );
}

function Profile() {
  const { user } = useUserStore();

  return (
    <div className="flex items-center gap-4">
      <Avatar className="w-20 h-20">
        <AvatarImage src="https://github.com/shadcn.png" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <>
          <h2 className="text-2xl font-medium">{user?.name}</h2>
          <p className="text-base text-muted-foreground">{user?.email}</p>
        </>
      </div>
    </div>
  );
}
