import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface TableOccupancyChartProps {
  occupied: number;
  available: number;
}

export const TableOccupancyChart = ({ occupied, available }: TableOccupancyChartProps) => {
  const data = [
    { name: "Occupied", value: occupied },
    { name: "Available", value: available },
  ];

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--success))"];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="value"
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};
