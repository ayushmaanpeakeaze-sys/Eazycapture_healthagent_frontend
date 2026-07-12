import { ApexOptions } from "apexcharts";

import { axisMoney } from "./format";

export const baseChart = (): ApexOptions["chart"] => ({
  toolbar: { show: false },
  zoom: { enabled: false },
  fontFamily: "Inter, system-ui, sans-serif",
  animations: { enabled: true, speed: 450 },
  parentHeightOffset: 0,
});

export const miniAxisX = (categories: string[]): ApexOptions["xaxis"] => ({
  categories,
  tickAmount: 6,
  labels: {
    rotate: -40,
    hideOverlappingLabels: true,
    style: { colors: "#94a3b8", fontSize: "9px" },
  },
  axisBorder: { color: "rgba(148,163,184,0.25)" },
  axisTicks: { show: false },
  tooltip: { enabled: false },
});

export const miniAxisY = (): ApexOptions["yaxis"] => ({
  labels: {
    formatter: (v: number) => axisMoney(v),
    style: { colors: "#94a3b8", fontSize: "9px" },
  },
});

export const gridStyle = (): ApexOptions["grid"] => ({
  borderColor: "rgba(148,163,184,0.15)",
  padding: { left: 4, right: 4 },
  xaxis: { lines: { show: false } },
});
