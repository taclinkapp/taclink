import { useOperatorProfile } from "@/hooks/useOperatorProfile";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export const TaclinkScoreBadge = ({
  studentId,
  className,
}: {
  studentId: string | null | undefined;
  className?: string;
}) => {
  const { data } = useOperatorProfile(studentId);
  if (!studentId) return null;
  const score = data?.taclinkScore ?? 0;
  return (
    <span
      title={`${score} TacLink Score`}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-primary/30 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      <Shield className="h-2.5 w-2.5" />
      {score}
    </span>
  );
};
