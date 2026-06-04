import { describe, expect, it } from "vitest";

import { demoSubject } from "@/lib/demo/seedData";
import { assertDemoSubjectAllowed, isDemoModeEnforced } from "@/lib/warehouse/demoModeGuard";

describe("demo mode guard", () => {
  it("allows synthetic demo subject when demo mode is on", () => {
    const previous = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "true";
    expect(() => assertDemoSubjectAllowed(demoSubject)).not.toThrow();
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  });

  it("blocks unknown subjects when demo mode is on", () => {
    const previous = process.env.CONSENTOPS_DEMO_MODE;
    process.env.CONSENTOPS_DEMO_MODE = "true";
    expect(() => assertDemoSubjectAllowed({ ...demoSubject, id: "subj_other" })).toThrow(
      /Demo mode restricts/,
    );
    if (previous === undefined) delete process.env.CONSENTOPS_DEMO_MODE;
    else process.env.CONSENTOPS_DEMO_MODE = previous;
  });

  it("does not enforce allowlist when demo flags are off", () => {
    delete process.env.DEMO_MODE;
    delete process.env.CONSENTOPS_DEMO_MODE;
    expect(isDemoModeEnforced()).toBe(false);
    expect(() => assertDemoSubjectAllowed({ ...demoSubject, id: "subj_other" })).not.toThrow();
  });
});
