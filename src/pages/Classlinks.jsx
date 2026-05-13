import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Printer,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 10;

export default function ClassLinks() {
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [copied, setCopied] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-all-links'],
    queryFn: () => base44.entities.Student.list('-created_date', 5000),
  });

  const classes = useMemo(() => {
    const map = {};

    students.forEach((s) => {
      if (!s?.department || !s?.level || !s?.year || !s?.group) return;

      const key = `${s.department}|${s.level}|${s.year}|${s.group}`;
      if (!map[key]) {
        map[key] = {
          department: s.department,
          level: s.level,
          year: s.year,
          group: s.group,
          count: 0,
          key,
        };
      }

      map[key].count += 1;
    });

    return Object.values(map).sort(
      (a, b) =>
        a.department.localeCompare(b.department) ||
        a.level.localeCompare(b.level) ||
        a.year.localeCompare(b.year) ||
        a.group.localeCompare(b.group)
    );
  }, [students]);

  const departments = useMemo(() => {
    return Array.from(new Set(classes.map((c) => c.department))).sort();
  }, [classes]);

  const filteredByDept = useMemo(() => {
    if (selectedDepartment === 'all') return classes;
    return classes.filter((c) => c.department === selectedDepartment);
  }, [classes, selectedDepartment]);

  const filtered = useMemo(() => {
    if (selectedRoom === 'all') return filteredByDept;
    return filteredByDept.filter((c) => c.key === selectedRoom);
  }, [filteredByDept, selectedRoom]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDepartment, selectedRoom, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const getUrl = (c) => {
    const base = window.location.origin;
    return `${base}/class-report/${encodeURIComponent(c.department)}/${encodeURIComponent(c.level)}/${c.year}/${c.group}`;
  };

  const getQrUrl = (url) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
  };

  const printedDate = useMemo(() => {
    return new Date().toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const totalPrintPages = Math.max(1, Math.ceil(filtered.length / 12));

  const handleCopy = (c) => {
    navigator.clipboard.writeText(getUrl(c));
    setCopied(c.key);
    toast.success('คัดลอกลิงก์แล้ว');
    setTimeout(() => setCopied(''), 2000);
  };

  const renderQrWithLogo = (url, alt, qrClassName) => (
    <div className="relative rounded border bg-white p-1">
      <img src={url} alt={alt} className={qrClassName} loading="lazy" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="w-6 h-6 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-300">
          <img
            src="https://tnc-check01.gt.tc/img/logo.png"
            alt="โลโก้กลางคิวอาร์โค้ด"
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
          <span className="hidden text-[8px] font-bold text-slate-700">วท</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 print-classlinks-page print-mode-grid">
      <div className="screen-only">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              ลิงก์ห้องเรียน
            </h2>
            <p className="text-sm text-muted-foreground">หน้าหลัก / ลิงก์ห้องเรียน</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'card' ? 'outline' : 'default'}
              className="gap-1.5"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
              แบบรายการ
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'card' ? 'default' : 'outline'}
              className="gap-1.5"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="w-4 h-4" />
              แบบการ์ด
            </Button>
          </div>
        </div>

        <Card className="mt-3">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
              <Select
                value={selectedDepartment}
                onValueChange={(val) => {
                  setSelectedDepartment(val);
                  setSelectedRoom('all');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด ({classes.length} ห้อง)</SelectItem>
                  {departments.map((d) => {
                    const deptCount = classes.filter((c) => c.department === d).length;
                    return (
                      <SelectItem key={d} value={d}>
                        {d} ({deptCount} ห้อง)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด ({filteredByDept.length} ห้อง)</SelectItem>
                  {filteredByDept.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.level} ปี{c.year} กลุ่ม{c.group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}>
                <Printer className="w-4 h-4" />
                พิมพ์ QR
              </Button>
            </div>

          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">ไม่พบห้องเรียน</p>
        ) : viewMode === 'list' ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[110px_1fr_110px_110px_190px_110px] px-4 py-3 text-xs font-semibold text-muted-foreground border-b bg-muted/40">
                    <div>ห้องเรียน</div>
                    <div></div>
                    <div>ระดับชั้น</div>
                    <div>นักศึกษา</div>
                    <div>QR Code</div>
                    <div>จัดการ</div>
                  </div>

                  {paged.map((c) => {
                    const url = getUrl(c);
                    const roomLabel = `${c.level} ปี${c.year} กลุ่ม${c.group}`;
                    const isCopied = copied === c.key;

                    return (
                      <div key={c.key} className="grid grid-cols-[110px_1fr_110px_110px_190px_110px] items-center px-4 py-3 border-b last:border-b-0">
                        <div>
                          {renderQrWithLogo(
                            getQrUrl(url),
                            `QR ${c.department} ${roomLabel}`,
                            'w-[86px] h-[86px] object-contain'
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-sm">{c.department}</p>
                          <p className="text-xs text-muted-foreground mt-1">{roomLabel}</p>
                          <p className="text-xs text-muted-foreground mt-1">อัปเดตล่าสุด {c.count} คน</p>
                        </div>

                        <div>
                          <Badge variant="outline">{c.level}</Badge>
                        </div>

                        <div className="text-sm font-medium">{c.count} คน</div>

                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleCopy(c)}>
                            {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                          </Button>
                          <Button size="sm" asChild>
                            <a href={url} target="_blank" rel="noreferrer" className="gap-1.5 flex items-center">
                              <ExternalLink className="w-3.5 h-3.5" />
                              เปิด
                            </a>
                          </Button>
                        </div>

                        <div className="flex justify-center">
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border-t text-sm">
                <p className="text-muted-foreground">
                  แสดง {filtered.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + PAGE_SIZE, filtered.length)} จาก {filtered.length} ห้อง
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-3 py-1 rounded border text-sm">{currentPage}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {paged.map((c) => {
              const url = getUrl(c);
              const roomLabel = `${c.level} ปี${c.year} กลุ่ม${c.group}`;
              const isCopied = copied === c.key;

              return (
                <Card key={c.key}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {renderQrWithLogo(
                        getQrUrl(url),
                        `QR ${c.department} ${roomLabel}`,
                        'w-20 h-20 object-contain'
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{c.department}</p>
                        <p className="text-xs text-muted-foreground">{roomLabel}</p>
                        <p className="text-xs text-muted-foreground mt-1">นักศึกษา {c.count} คน</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleCopy(c)}>
                        {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {isCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </Button>
                      <Button size="sm" asChild>
                        <a href={url} target="_blank" rel="noreferrer" className="gap-1.5 flex items-center">
                          <ExternalLink className="w-3.5 h-3.5" />
                          เปิด
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="print-only">
        <div className="print-sheet">
          <div className="print-sheet-meta">
            <span>✂ ตัดตามเส้นประ</span>
            <span>พิมพ์วันที่ {printedDate} | หน้า 1 จาก {totalPrintPages}</span>
          </div>
          <div className="grid gap-3 print-qr-grid">
            {filtered.map((c) => {
              const url = getUrl(c);
              const roomLabel = `${c.level} ปี${c.year} กลุ่ม${c.group}`;
              return (
                <Card key={c.key} className="print-qr-card">
                  <CardContent className="p-4">
                    <div className="print-card-row">
                      <div className="print-qr-wrap">
                        <div className="relative rounded-lg border bg-white p-1.5">
                          <img
                            src={getQrUrl(url)}
                            alt={`QR ${c.department} ${roomLabel}`}
                            className="print-qr-image w-[112px] h-[112px] object-contain"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-5 h-5 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
                              <img
                                src="https://tnc-check01.gt.tc/img/logo.png"
                                alt="โลโก้กลางคิวอาร์โค้ด"
                                className="print-qr-center-logo w-full h-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling;
                                  if (fallback) fallback.classList.remove('hidden');
                                }}
                              />
                              <span className="hidden text-[8px] font-bold text-slate-700">วท</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="print-card-info">
                        <p className="print-college">วิทยาลัยเทคนิคจันทบุรี</p>
                        <p className="print-unit">งานกิจกรรมนักเรียน นักศึกษา</p>
                        <h3 className="print-room-title">{c.department}</h3>
                        <p className="print-room-subtitle">{roomLabel}</p>

                        <div className="print-badges">
                          <span className="print-pill">{c.level}</span>
                          <span className="print-pill">{c.count} คน</span>
                          <span className="print-pill print-pill-primary">ห้อง {c.group}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="print-sheet-footer">งานกิจกรรมนักเรียน นักศึกษา วิทยาลัยเทคนิคจันทบุรี</p>
        </div>
      </div>
    </div>
  );
}
