/**
 * Stub mock for recharts — required by @mdxui/admin SaaS analytics charts.
 * Our @headlessly/ui components don't use charts; this prevents import failures.
 */
import * as React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>

export const Area = stub
export const AreaChart = stub
export const Bar = stub
export const BarChart = stub
export const CartesianGrid = stub
export const Cell = stub
export const Label = stub
export const Line = stub
export const LineChart = stub
export const Pie = stub
export const PieChart = stub
export const ReferenceLine = stub
export const ResponsiveContainer = stub
export const Sankey = stub
export const Scatter = stub
export const ScatterChart = stub
export const Tooltip = stub
export const XAxis = stub
export const YAxis = stub
