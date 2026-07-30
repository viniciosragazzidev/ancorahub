type SparklinePoint = {
  label: string;
  value: number;
};

type SparklineProps = {
  data: SparklinePoint[];
  colorClassName?: string;
  className?: string;
  id: string;
};

export function Sparkline({
  data,
  colorClassName = "text-primary",
  className,
  id,
}: SparklineProps) {
  const values = data.map((point) => point.value);
  const max = Math.max(...values, 1);

  return (
    <div className={className} aria-hidden="true">
      <svg viewBox="0 0 100 36" className="h-9 w-full overflow-visible text-primary">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={data
            .map((point, index) => {
              const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
              const y = 30 - (point.value / max) * 22;
              return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`${data
            .map((point, index) => {
              const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
              const y = 30 - (point.value / max) * 22;
              return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ")} L 100 34 L 0 34 Z`}
          fill={`url(#${id})`}
        />
        {data.map((point, index) => {
          const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
          const y = 30 - (point.value / max) * 22;
          return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="1.8" fill="currentColor" />;
        })}
      </svg>
    </div>
  );
}
