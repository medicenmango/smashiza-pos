const loadedListeners = [];
const syncListeners = [];

export function onDataLoaded(fn){ loadedListeners.push(fn); }
export function emitDataLoaded(){ loadedListeners.forEach(fn=>fn()); }

export function onSyncChange(fn){ syncListeners.push(fn); }
export function emitSyncChange(){ syncListeners.forEach(fn=>fn()); }
