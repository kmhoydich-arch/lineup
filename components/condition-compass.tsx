import { compassPoint, normalizeDeg } from "@/lib/geo";
import type { DerivedHour, Spot } from "@/lib/types";

function sourcePoint(fromDeg: number, facing: number, radius: number) {
  const rel = normalizeDeg(fromDeg - facing);
  const rad = (rel * Math.PI) / 180;
  return {
    x: 100 + Math.sin(rad) * radius,
    y: 100 - Math.cos(rad) * radius,
  };
}

function Arrow({
  fromDeg,
  facing,
  color,
  label,
}: {
  fromDeg: number;
  facing: number;
  color: string;
  label: string;
}) {
  const start = sourcePoint(fromDeg, facing, 62);
  const end = sourcePoint(fromDeg, facing, 28);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 7;
  const left = {
    x: end.x - head * Math.cos(angle - 0.45),
    y: end.y - head * Math.sin(angle - 0.45),
  };
  const right = {
    x: end.x - head * Math.cos(angle + 0.45),
    y: end.y - head * Math.sin(angle + 0.45),
  };
  return (
    <g aria-hidden="true">
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <polygon points={`${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={color} />
      <text x={start.x} y={start.y - 8} textAnchor="middle" fill={color} fontSize="9" fontWeight="600">
        {label}
      </text>
    </g>
  );
}

export function ConditionCompass({ spot, hour }: { spot: Spot; hour: DerivedHour }) {
  const north = sourcePoint(0, spot.facing, 78);
  const side = hour.swellSigned >= 0 ? "the right" : "the left";
  const aim =
    hour.swellAngle <= 15
      ? "The swell is nearly straight in."
      : `The swell is ${Math.round(hour.swellAngle)}° from ${side} of straight in.`;

  return (
    <figure className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-center">
      <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[200px]" role="img" aria-label="Beach-relative swell and wind">
        <circle cx="100" cy="100" r="86" fill="#f3ecdf" stroke="#ddcfb8" />
        <path d="M28 132 Q100 108 172 132 L172 168 Q100 150 28 168 Z" fill="#e7d3b0" />
        <text x="100" y="28" textAnchor="middle" fill="#5c6a72" fontSize="10">
          Out to sea
        </text>
        <text x="100" y="186" textAnchor="middle" fill="#8a5a10" fontSize="10">
          Beach
        </text>
        <text x={north.x} y={north.y} textAnchor="middle" dominantBaseline="middle" fill="#17242c" fontSize="11" fontWeight="700">
          N
        </text>
        <Arrow fromDeg={hour.swellDir} facing={spot.facing} color="#1d4e89" label="Swell" />
        <Arrow fromDeg={hour.windDir} facing={spot.facing} color="#e07a3d" label="Wind" />
      </svg>
      <figcaption className="space-y-2 text-sm leading-6 text-muted-foreground">
        <p>
          This diagram puts the ocean at the top, the way it looks when you stand on the sand and face out. North is marked so the compass still has a real bearing.
        </p>
        <p className="text-foreground">{aim}</p>
        <p>
          Swell from the {compassPoint(hour.swellDir)}. Wind from the {compassPoint(hour.windDir)}, blowing {hour.windType === "glassy" ? "too lightly to texture the surface" : hour.windType}.
        </p>
      </figcaption>
    </figure>
  );
}
