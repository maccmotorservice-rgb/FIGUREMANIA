import type { Figure, Replay } from "./engine";
// Future adapters run through an authenticated backend, never an AI key in the client.
export interface FigureRecognition {
  suggest(
    photo: Blob,
    registered: Figure[],
  ): Promise<{ figureId: string; confidence: number }[]>;
}
export interface ReplayProvider {
  request(
    replay: Replay,
    options: { maxCost: number; idempotencyKey: string },
  ): Promise<{ jobId: string }>;
  status(
    jobId: string,
  ): Promise<{ status: Replay["status"]; videoUrl?: string }>;
}
export const replayAvailability = {
  available: false,
  message:
    "Generación de video no disponible. Falta conectar un proveedor mediante backend.",
};
