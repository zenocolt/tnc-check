import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = {
  'มา': 'hsl(142, 64%, 42%)',
  'ขาด': 'hsl(0, 72%, 51%)',
  'ลา': 'hsl(45, 93%, 58%)',
  'สาย': 'hsl(25, 90%, 55%)',
};

export default function DailyChart({ data }) {
  const chartData = Object.entries(data || {}).map(([name, value]) => ({ name, value }));

  if (chartData.every(d => d.value === 0)) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">สรุปยอดวันนี้</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">ยังไม่มีข้อมูลวันนี้</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">สรุปยอดวันนี้</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => (value > 0 ? `${name}: ${value}` : '')}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                background: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }} 
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}