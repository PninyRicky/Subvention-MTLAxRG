import { Card } from "@/components/ui/card";

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-3">
          <div className="h-3 w-32 animate-pulse rounded-full bg-black/[0.06]" />
          <div className="h-10 w-[26rem] max-w-full animate-pulse rounded-full bg-black/[0.08]" />
          <div className="h-4 w-[34rem] max-w-full animate-pulse rounded-full bg-black/[0.05]" />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={`loading-main-${index}`}>
              <div className="space-y-4">
                <div className="h-3 w-28 animate-pulse rounded-full bg-black/[0.06]" />
                {Array.from({ length: 4 }).map((__, lineIndex) => (
                  <div
                    key={`loading-main-${index}-${lineIndex}`}
                    className="h-4 animate-pulse rounded-full bg-black/[0.05]"
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={`loading-side-${index}`}>
              <div className="space-y-4">
                <div className="h-3 w-24 animate-pulse rounded-full bg-black/[0.06]" />
                {Array.from({ length: 3 }).map((__, lineIndex) => (
                  <div
                    key={`loading-side-${index}-${lineIndex}`}
                    className="h-4 animate-pulse rounded-full bg-black/[0.05]"
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
