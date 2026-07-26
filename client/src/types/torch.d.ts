// Types for Torch API and Battery API

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => any) | null;
}

interface Navigator {
  getBattery?(): Promise<BatteryManager>;
}

interface MediaTrackCapabilities {
  torch?: boolean;
  zoom?: number;
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
}

interface MediaTrackConstraintSet {
  torch?: boolean;
}

interface MediaTrackSupportedConstraints {
  torch?: boolean;
}
