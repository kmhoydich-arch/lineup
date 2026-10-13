import type { Units } from "@/lib/format";
import { formatFacePrecise, formatSpeed, formatSwellHeight, formatTide } from "@/lib/format";
import { compassPoint } from "@/lib/geo";
import { clockLabel } from "@/lib/time";
import type { DerivedHour } from "@/lib/types";
import { windLabel } from "@/lib/summary";

export function HourlyTable({
  hours,
  units,
  windowStart,
  windowEnd,
}: {
  hours: DerivedHour[];
  units: Units;
  windowStart: string | null;
  windowEnd: string | null;
}) {
  return (
    <div className="max-w-full min-w-0 overflow-x-auto rounded-2xl ring-1 ring-foreground/10">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">Hourly surf, swell, wind, tide, and score</caption>
        <thead className="bg-secondary/70 text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {["Time", "Face", "Swell", "Period", "Dir", "Wind", "Type", "Tide", "Score"].map((label) => (
              <th key={label} scope="col" className="px-3 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => {
            const highlighted =
              windowStart != null &&
              windowEnd != null &&
              hour.time >= windowStart &&
              hour.time < windowEnd;
            return (
              <tr key={hour.time} className={highlighted ? "bg-[#e5f3ef]" : "odd:bg-card even:bg-[#f3ecdf]"}>
                <th scope="row" className="px-3 py-2 font-medium whitespace-nowrap">
                  {clockLabel(hour.time)}
                </th>
                <td className="px-3 py-2 tabular-nums">{formatFacePrecise(hour.faceFt, units)}</td>
                <td className="px-3 py-2 tabular-nums">{formatSwellHeight(hour.swellHeightM, units)}</td>
                <td className="px-3 py-2 tabular-nums">{Math.round(hour.swellPeriodS)}s</td>
                <td className="px-3 py-2">{compassPoint(hour.swellDir)}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {formatSpeed(hour.windSpeedMs, units)} {compassPoint(hour.windDir)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{windLabel(hour.windType)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {hour.tideM == null ? "—" : formatTide(hour.tideM, units)}
                </td>
                <td className="px-3 py-2 tabular-nums">{hour.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
