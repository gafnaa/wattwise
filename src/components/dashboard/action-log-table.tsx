"use client";

import * as React from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { TextMorph } from "torph/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah, type ActionLogItem } from "@/lib/mock-dashboard-data";

interface ActionLogTableProps {
  logs: ActionLogItem[];
  searchQuery?: string;
  onToggleStatus: (id: string) => void;
}

export function ActionLogTable({
  logs,
  searchQuery = "",
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
    <Card className="border-border/80 bg-card/90">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-semibold text-white">
          Daftar Tindakan
        </CardTitle>

        <Badge
          variant="outline"
          className="border-emerald-500/35 bg-emerald-500/10 font-mono text-[11px] text-emerald-300"
        >
          Terealisasi:{" "}
          <TextMorph>{`${formatRupiah(completedSavings)}/bln`}</TextMorph>
        </Badge>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50">
          <Table>
            <TableHeader>
              <TableRow className="border-border/70 hover:bg-transparent">
                <TableHead className="w-[72px] text-[11px] uppercase">
                  Tgl
                </TableHead>
                <TableHead className="w-[150px] text-[11px] uppercase">
                  Mesin
                </TableHead>
                <TableHead className="text-[11px] uppercase">
                  Tindakan
                </TableHead>
                <TableHead className="w-[105px] text-[11px] uppercase">
                  Status
                </TableHead>
                <TableHead className="w-[120px] text-right text-[11px] uppercase">
                  Hemat/Bln
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-xs text-zinc-500"
                  >
                    Tidak ada tindakan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const done = log.status === "COMPLETED";
                  return (
                    <TableRow
                      key={log.id}
                      className="border-border/60 hover:bg-muted/30"
                    >
                      <TableCell className="font-mono text-xs text-zinc-400">
                        {log.dateLabel}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-white">
                        {log.machineName}
                      </TableCell>
                      <TableCell className="max-w-[280px] text-xs whitespace-normal text-zinc-300">
                        {log.recommendation}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(log.id)}
                          className="focus-visible:outline-none"
                        >
                          {done ? (
                            <Badge className="cursor-pointer border border-emerald-500/35 bg-emerald-500/15 text-[11px] text-emerald-300">
                              <CheckCircle2 className="mr-1 size-3" />
                              Selesai
                            </Badge>
                          ) : (
                            <Badge className="cursor-pointer border border-amber-500/35 bg-amber-500/15 text-[11px] text-amber-300">
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
