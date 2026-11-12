import v8 from "v8";
import path from "path";
import log from "./logger";
import { clients } from "../whatsapp_api";

const INTERVAL_MS = 5 * 60 * 1000;
const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

/**
 * Registra o uso de memória a cada 5 minutos, junto com a quantidade de
 * sessões por status, para dar para ver o que cresce até estourar o heap.
 *
 * `kill -USR2 <pid>` grava um heap snapshot em data/logs para abrir no
 * Chrome DevTools (Memory > Load). O snapshot ocupa uns 2x o heap enquanto é
 * gerado e trava o processo alguns segundos, então use fora do pico.
 */
export function startMemoryMonitor() {
  const report = () => {
    const mem = process.memoryUsage();
    const heap = v8.getHeapStatistics();
    const byStatus: Record<string, number> = {};
    for (const service of Object.values(clients)) {
      const status = service.getStatus();
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    }
    log.info(
      `memória: rss=${mb(mem.rss)}MB heap=${mb(mem.heapUsed)}/${mb(heap.heap_size_limit)}MB external=${mb(mem.external)}MB arrayBuffers=${mb(mem.arrayBuffers)}MB sessões=${JSON.stringify(byStatus)}`,
    );
  };
  report();
  setInterval(report, INTERVAL_MS).unref();

  process.on("SIGUSR2", () => {
    const file = path.join(
      "data/logs",
      `heap-${new Date().toISOString().replace(/[:.]/g, "-")}.heapsnapshot`,
    );
    log.warn(`gerando heap snapshot em ${file}...`);
    try {
      v8.writeHeapSnapshot(file);
      log.warn(`heap snapshot gravado em ${file}`);
    } catch (error) {
      log.error("falha ao gravar heap snapshot:", error);
    }
  });
}
