import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ProfileIdentity } from "../types";

interface ProfileHeaderProps {
  identity: ProfileIdentity;
}

function initialsFor(name: string | null): string {
  if (!name) return "?";

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

  return initials || "?";
}

export function ProfileHeader({ identity }: ProfileHeaderProps) {
  const displayName = identity.displayName ?? "Usuário";

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg">
        {identity.avatarUrl && (
          <AvatarImage src={identity.avatarUrl} alt={displayName} />
        )}
        <AvatarFallback>{initialsFor(identity.displayName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-xl font-semibold">{displayName}</span>
        {identity.email && (
          <span className="text-muted-foreground text-sm">
            {identity.email}
          </span>
        )}
      </div>
    </div>
  );
}
