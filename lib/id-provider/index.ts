import { BioclipProvider } from "./bioclip";
import { INaturalistProvider } from "./inaturalist";
import { KindwiseProvider } from "./kindwise";
import { MockProvider } from "./mock";
import type { IdProvider } from "./types";

export type { IdCandidate, IdOptions, IdProvider } from "./types";

let instance: IdProvider | null = null;

export function getIdProvider(): IdProvider {
  if (instance) return instance;
  const choice = (process.env.ID_PROVIDER ?? "mock").toLowerCase();
  instance =
    choice === "bioclip"
      ? new BioclipProvider()
      : choice === "kindwise"
        ? new KindwiseProvider()
        : choice === "inaturalist"
          ? new INaturalistProvider()
          : new MockProvider();
  return instance;
}
