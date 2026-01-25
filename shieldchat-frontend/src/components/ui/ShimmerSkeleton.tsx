"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "shimmer" | "pulse" | "none";
}

export function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
  animation = "shimmer",
}: SkeletonProps) {
  const variantClasses = {
    text: "rounded-md",
    circular: "rounded-full",
    rectangular: "rounded-xl",
  };

  const animationClasses = {
    shimmer: "animate-shimmer bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03] bg-[length:200%_100%]",
    pulse: "animate-pulse bg-white/[0.05]",
    none: "bg-white/[0.05]",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
      style={style}
      aria-hidden="true"
    />
  );
}

// Pre-composed skeleton patterns
export function MessageSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
          <Skeleton variant="circular" width={40} height={40} />
          <div className={`space-y-2 ${i % 2 === 0 ? "" : "items-end"}`}>
            <Skeleton width={80} height={14} />
            <Skeleton
              variant="rectangular"
              width={i % 2 === 0 ? 240 : 180}
              height={60}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChannelListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]"
        >
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton width="70%" height={18} />
          <Skeleton width="50%" height={14} />
        </div>
      </div>
      <Skeleton variant="rectangular" width="100%" height={80} />
      <div className="flex justify-end gap-2">
        <Skeleton width={80} height={36} variant="rectangular" />
        <Skeleton width={80} height={36} variant="rectangular" />
      </div>
    </div>
  );
}

// Alias for convenience
export { Skeleton as ShimmerSkeleton };
