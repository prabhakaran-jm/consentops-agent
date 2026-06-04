import { demoSubject } from "@/lib/demo/seedData";
import type { ConsentSubject } from "@/lib/warehouse/types";

export const DEMO_SYNTHETIC_SUBJECT_IDS = [demoSubject.id] as const;

const envFlagEnabled = (name: string): boolean => {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
};

export const isDemoModeEnforced = (): boolean =>
  envFlagEnabled("CONSENTOPS_DEMO_MODE") || envFlagEnabled("DEMO_MODE");

export const assertDemoSubjectAllowed = (subject: ConsentSubject): void => {
  if (!isDemoModeEnforced()) return;

  if (!DEMO_SYNTHETIC_SUBJECT_IDS.includes(subject.id as (typeof DEMO_SYNTHETIC_SUBJECT_IDS)[number])) {
    throw new Error(
      `Demo mode restricts operations to synthetic subjects: ${DEMO_SYNTHETIC_SUBJECT_IDS.join(", ")}.`,
    );
  }
};
