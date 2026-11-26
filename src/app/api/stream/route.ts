import { getCurrentSession } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";

/**
 * Server-Sent Events (SSE) stream untuk pembaruan status mesin & daya real-time
 * sesuai ARCHITECTURE.md (interval push 3 detik, teardown aman saat client putus).
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  const encoder = new TextEncoder();

  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const pushSnapshot = async () => {
        try {
          const overview = await getDashboardOverview(
            "today",
            session?.workshopId
          );
          const payload = {
            timestamp: new Date().toISOString(),
            dataSource: overview.dataSource,
            esp32OnlineCount: overview.workshop.esp32OnlineCount,
            esp32TotalCount: overview.workshop.esp32TotalCount,
            virtualSensor: overview.virtualSensor,
            machines: overview.machines.map((m) => ({
              id: m.id,
              code: m.code,
              name: m.name,
              status: m.status,
              currentPowerW: m.currentPowerW,
              currentA: m.currentA,
              powerFactor: m.powerFactor,
              sessionDurationSec: m.sessionDurationSec,
            })),
          };
          controller.enqueue(
            encoder.encode(`event: snapshot\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          controller.enqueue(
            encoder.encode(
              `event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`
            )
          );
        }
      };

      // Kirim snapshot awal segera
      await pushSnapshot();

      timer = setInterval(() => {
        void pushSnapshot();
      }, 3000);

      request.signal.addEventListener("abort", () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        try {
          controller.close();
        } catch {
          // Stream sudah ditutup
        }
      });
    },
    cancel() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
