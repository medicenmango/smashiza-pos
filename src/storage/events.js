const loadedListeners = [];

export function onDataLoaded(fn){ loadedListeners.push(fn); }

export function emitDataLoaded(){ loadedListeners.forEach(fn=>fn()); }
