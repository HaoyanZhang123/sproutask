/**
 * Frozen contract versions for the education workspace.
 *
 * Bump rules: any incompatible change to exported types, validation rules,
 * fixture shape or service payloads requires a new contract version and a
 * matching update of docs/rebuild/contract-lock.json.
 */

/** Version stored on every persisted entity (`schemaVersion: 1`). */
export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

/** Version of the service port payloads in `services/ports.ts`. */
export const SERVICE_API_VERSION = 1 as const;

/** Version of the feature/page registration contract in `runtime/`. */
export const FEATURE_API_VERSION = 1 as const;

/** Human readable contract version recorded in contract-lock.json. */
export const CONTRACT_VERSION = '1.0.0' as const;

/** Default review scheduling policy version (heuristic, T06 owns tuning). */
export const REVIEW_POLICY_VERSION = 'review-policy-v1' as const;
