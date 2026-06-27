import { useEffect, useState } from "react";

interface HealthGaugeProps {
  score: number;
  size?: number;
}

const ringColor = (score: number): string => {
  if (score >= 85) return "#10b981";
  if (score >= 65) return "#0052cc";
  if (score >= 45) return "#f59e0b";
  return "#ef4444";
};

export const HealthGauge = ({ score, size = 200 }: HealthGaugeProps) => {
  const [animated, setAnimated] = useState(0);
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - animated / 100);
  const color = ringColor(animated);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, score));
    let frame = 0;
    const total = 30;
    const start = animated;
    const step = () => {
      frame += 1;
      const eased = start + (target - start) * (frame / total);
      setAnimated(Math.round(eased));
      if (frame < total) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-semibold tracking-tight"
          style={{ color }}
        >
          {animated}
        </span>
        <span className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Health Score
        </span>
      </div>
    </div>
  );
};
