import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function DepartmentChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">สถิติแยกตามแผนกวิชา</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">ยังไม่มีข้อมูล</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">สถิติแยกตามแผนกวิชา</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip 
              contentStyle={{ 
                background: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }} 
            />
            <Legend />
            <Bar dataKey="มา" fill="hsl(142, 64%, 42%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ขาด" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ลา" fill="hsl(45, 93%, 58%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="สาย" fill="hsl(25, 90%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}