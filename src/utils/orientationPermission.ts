export type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};

export const requiresOrientationPermission =
  typeof DeviceOrientationEvent !== "undefined" &&
  typeof (DeviceOrientationEvent as DeviceOrientationEventWithPermission)
    .requestPermission === "function";

export async function requestOrientationPermission(): Promise<
  "granted" | "denied" | "not-required"
> {
  if (!requiresOrientationPermission) {
    return "not-required";
  }

  try {
    const permission = await (
      DeviceOrientationEvent as DeviceOrientationEventWithPermission
    ).requestPermission?.();

    return permission === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}
