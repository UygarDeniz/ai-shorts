import { Badge } from "@/components/ui/badge";
import type { VideoStatus } from "@/types/video";

const STEPS: { key: VideoStatus; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "scripting", label: "Writing Script" },
  { key: "voicing", label: "Generating Voice" },
  { key: "generating", label: "Creating Video" },
  { key: "merging", label: "Merging Media" },
  { key: "completed", label: "Completed" },
];

interface ProgressTrackerProps {
  status: VideoStatus;
}

export function ProgressTracker({ status }: ProgressTrackerProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === status);
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  return (
    <div className="w-full max-w-md space-y-3">
      {STEPS.map((step, index) => {
        let state: "done" | "active" | "pending" | "failed" = "pending";

        if (isFailed && index === currentIndex) {
          state = "failed";
        } else if (index < currentIndex) {
          state = "done";
        } else if (index === currentIndex) {
          state = isCompleted ? "done" : "active";
        }

        return (
          <div key={step.key} className="flex items-center gap-3">
            <StepIndicator state={state} index={index} />
            <span
              className={`text-sm font-medium ${
                state === "done"
                  ? "text-muted-foreground line-through"
                  : state === "active"
                    ? "text-foreground"
                    : state === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground/50"
              }`}
            >
              {step.label}
            </span>
            {state === "active" && !isFailed && (
              <Badge variant="secondary" className="animate-pulse text-xs">
                In Progress
              </Badge>
            )}
            {state === "failed" && (
              <Badge variant="destructive" className="text-xs">
                Failed
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepIndicator({
  state,
  index,
}: {
  state: "done" | "active" | "pending" | "failed";
  index: number;
}) {
  const base =
    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-all";

  if (state === "done") {
    return (
      <div
        className={`${base} border-primary bg-primary text-primary-foreground`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className={`${base} border-primary bg-primary/10 text-primary`}>
        <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div
        className={`${base} border-destructive bg-destructive text-destructive-foreground`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${base} border-muted text-muted-foreground/50`}>
      {index + 1}
    </div>
  );
}
