import { NativeModule, requireNativeModule } from 'expo-modules-core';

type WatchMessage = Record<string, any>;

interface WatchConnectivityModuleEvents extends Record<string, (...args: any[]) => void> {
  onMessage: (message: WatchMessage) => void;
  onWatchStateChange: (state: { reachable: boolean }) => void;
}

declare class WatchConnectivityModuleType extends NativeModule<WatchConnectivityModuleEvents> {
  isWatchAppInstalled: boolean;
  updateApplicationContext(context: WatchMessage): boolean;
  sendQuickLogResult(payload: WatchMessage): boolean;
}

const nativeModule = requireNativeModule<WatchConnectivityModuleType>('WatchConnectivity');

export const isWatchAppInstalled = (): boolean => {
  try {
    return nativeModule.isWatchAppInstalled;
  } catch {
    return false;
  }
};

// Push the latest snapshot down to the watch. Always-latest-wins delivery,
// so callers should just call this on every state change rather than diffing.
export const updateWatchContext = (context: WatchMessage): boolean => {
  try {
    return nativeModule.updateApplicationContext(context);
  } catch {
    return false;
  }
};

// Real-time ack for a quick-log result. Unlike updateWatchContext, this
// can't be silently superseded by the next snapshot push, so it's the one
// to use for anything the watch needs to react to as a discrete event.
export const sendQuickLogResult = (payload: WatchMessage): boolean => {
  try {
    return nativeModule.sendQuickLogResult(payload);
  } catch {
    return false;
  }
};

// Fires for messages sent from the watch (quick-log text, etc).
export const addWatchMessageListener = (listener: (message: WatchMessage) => void) => {
  return nativeModule.addListener('onMessage', listener);
};

export const addWatchReachabilityListener = (listener: (state: { reachable: boolean }) => void) => {
  return nativeModule.addListener('onWatchStateChange', listener);
};
