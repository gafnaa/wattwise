"use client";

import * as React from "react";
import { CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatRupiah,
  type ActionLogItem,
} from "@/lib/mock-dashboard-data";

interface ActionLogTableProps {
  logs: ActionLogItem[];
  searchQuery: string;
  onToggleStatus: (id: string) => void;
}

export function ActionLogTable({
  logs,
  searchQuery,
  onToggleStatus,
}: ActionLogTableProps) {
  const filteredLogs = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (item) =>
        item.machineName.toLowerCase().includes(q) ||
        item.recommendation.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  const completedSavings = React.useMemo(
    () =>
      logs
        .filter((l) => l.status === "COMPLETED")
        .reduce((sum, l) => sum + l.estimatedSavingIdr, 0),
    [logs]
  );

  return (
    <Card className="flex h-full flex-col border-border/80 bg-card/90 shadow-lg shadow-black/25">
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="size-4 text-orange-400" />
            Log Tindakan Otomatisasi &amp; Rekomendasi AI
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Klik status untuk menandai tindakan yang sudah diterapkan di bengkel
          </CardDescription>
        </div>

        <Badge
          variant="outline"
          className="w-fit border-emerald-500/35 bg-emerald-500/10 font-mono text-[11px] text-emerald-300"
        >
          Terealisasi: {formatRupiah(completedSavings)}/bln
        </Badge>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50">
          <Table>
            <TableHeader>
              <TableRow className="border-border/70 hover:bg-transparent">
                <TableHead className="w-[76px] text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Tanggal
                </TableHead>
                <TableHead className="w-[150px] text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Mesin Furnitur
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Rekomendasi Aksi
                </TableHead>
                <TableHead className="w-[110px] text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Status
                </TableHead>
                <TableHead className="w-[125px] text-right text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Hemat / Bln
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-xs text-muted-foreground"
                  >
                    Tidak ada log rekomendasi yang cocok dengan pencarian.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const isCompleted = log.status === "COMPLETED";
                  return (
                    <TableRow
                      key={log.id}
                      className="border-border/60 hover:bg-muted/30"
                    >
                      <TableCell className="font-mono text-xs text-zinc-400">
                        {log.dateLabel}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-zinc-100">
                        {log.machineName}
                      </TableCell>
                      <TableCell className="max-w-[260px] text-xs whitespace-normal text-zinc-300">
                        {log.recommendation}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(log.id)}
                          className="focus-visible:outline-none"
                          title="Klik untuk ubah status penerapan"
                        >
                          {isCompleted ? (
                            <Badge className="cursor-pointer border border-emerald-500/35 bg-emerald-500/15 text-[11px] text-emerald-300 hover:bg-emerald-500/25">
                              <CheckCircle2 className="mr-1 size-3" />
                              Selesai
                            </Badge>
                          ) : (
                            <Badge className="cursor-pointer border border-amber-500/35 bg-amber-500/15 text-[11px] text-amber-300 hover:bg-amber-500/25">
                              <Clock3 className="mr-1 size-3" />
                              Pending
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-emerald-400">
                        {formatRupiah(log.estimatedSavingIdr)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
