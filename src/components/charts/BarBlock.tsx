"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const INK_MUTED = "#8c94a5";
const GRID = "#efe8da";
const PRIMARY = "#5b7ea8";

type Datum = { label: string; value: number | null; hint?: string };

export default function BarBlock({
  data,
  suffix = "",
  max,
  ariaLabel,
}: {
  data: Datum[];
  suffix?: string;
  max?: number;
  ariaLabel: string;
}) {
  return (
    <div className="h-56 w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: INK_MUTED, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            domain={max ? [0, max] : [0, "auto"]}
            tick={{ fill: INK_MUTED, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(91,126,168,0.08)" }}
            formatter={(value, _name, entry) => [
              `${value}${suffix}${entry?.payload?.hint ? ` · ${entry.payload.hint}` : ""}`,
              "",
            ]}
            labelStyle={{ color: "#22304a", fontWeight: 700 }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #eae0ce",
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              color: "#22304a",
            }}
          />
          <Bar dataKey="value" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
