import { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";

import { ProfitabilityResponse } from "../../../types/insights.types";
import { Card } from "../components/Card";
import { baseChart, gridStyle, miniAxisX, miniAxisY } from "../lib/charts";
import { COLOR, gbp } from "../lib/format";

export const ProfitabilityCard = ({
  data,
  asOf,
}: {
  data: ProfitabilityResponse;
  asOf: string;
}) => {
  const categories = [...(data.periods ?? [])].reverse();
  const series = [
    { name: "Sales", data: [...(data.series?.sales ?? [])].reverse() },
    { name: "Gross profit", data: [...(data.series?.gross_profit ?? [])].reverse() },
    { name: "Net profit", data: [...(data.series?.net_profit ?? [])].reverse() },
  ];
  const options: ApexOptions = {
    chart: baseChart(),
    colors: [COLOR.sky, COLOR.brand, COLOR.emerald],
    stroke: { width: 2, curve: "smooth" },
    fill: { type: "solid", opacity: 0.16 },
    dataLabels: { enabled: false },
    legend: {
      position: "bottom",
      fontSize: "10px",
      labels: { colors: "#475569" },
      itemMargin: { horizontal: 5, vertical: 0 },
      markers: { size: 5 },
    },
    xaxis: miniAxisX(categories),
    yaxis: miniAxisY(),
    grid: gridStyle(),
    tooltip: { shared: true, intersect: false, y: { formatter: (v) => gbp(v) } },
  };
  return (
    <Card
      title="Profitability"
      help="Sales, gross and net profit by month."
      right={
        <span
          className={[
            "font-display text-lg font-semibold tabular-nums",
            (data.totals?.net_profit ?? 0) < 0 ? "text-rose-600" : "text-emerald-600",
          ].join(" ")}
        >
          {gbp(data.totals?.net_profit)}
        </span>
      }
    >
      <Chart options={options} series={series} type="area" height={170} />
      <p className="mt-1 text-[10px] text-ink-400">
        Net profit · 12mo · {data.report_name ?? "P&L"} as at{" "}
        {data.report_date ?? asOf}
      </p>
    </Card>
  );
};
