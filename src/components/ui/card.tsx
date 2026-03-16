import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]", className)}>
      {children}
    </div>
  );
}
