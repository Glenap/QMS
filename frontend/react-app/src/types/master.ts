// Barrel for the per-domain type modules (mirrors backend app/schemas/* split).
//
// master.ts used to be a single kitchen-sink file; it was split by domain so
// each area is edited in isolation. This barrel keeps the existing
// `from '.../types/master'` imports working with zero churn — going forward,
// prefer importing from the specific domain module (e.g. `types/cube`).

export * from './project';
export * from './confirmation';
export * from './supplier';
export * from './lab';
export * from './catalog';
export * from './floor';
export * from './mix';
export * from './document';
export * from './pour';
export * from './dispatch';
export * from './cube';
export * from './ncr';
export * from './ai';
export * from './analytics';
export * from './traceability';
export * from './alert';
