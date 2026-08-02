"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { DailyAccuracy } from "@/lib/stats";

const INK_MUTED = "#8c94a5";
const GRID = "#efe8da";
const PRIMARY = "#5b7ea8";

export default function AccuracyLine({ data }: { data: DailyAccuracy[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Line chart of daily reading accuracy">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: INK_MUTED, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: INK_MUTED, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: INK_MUTED, strokeDasharray: "3 3" }}
            formatter={(value) => [`${value}%`, "Accuracy"]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #eae0ce",
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              color: "#22304a",
            }}
          />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke={PRIMARY}
            strokeWidth={2}
            connectNulls
            dot={{ r: 3.5, fill: PRIMARY, strokeWidth: 0 }}
            activeDot={{ r: 5.5, fill: PRIMARY, stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
