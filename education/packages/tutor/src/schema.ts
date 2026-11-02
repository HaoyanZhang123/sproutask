/**
 * Minimal runtime JSON-Schema validator for tool parameters.
 *
 * The frozen domain validators cover entities; tool argument envelopes are a
 * separate boundary and must reject unknown keys, wrong types, invalid enums
 * and path-like IDs before any service call happens (A24/A28).
 */

import type { ToolParameterSchema, ToolParameterType } from './types.js';

export interface SchemaIssue {
  readonly path: string;
  readonly message: string;
}

export type SchemaValidation =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly issues: readonly SchemaIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateValue(
  schema: ToolParameterType,
  value: unknown,
  path: string,
  issues: SchemaIssue[],
): void {
  if (schema.enum !== undefined) {
    if (typeof value !== 'string' || !schema.enum.includes(value)) {
      issues.push({ path, message: `must be one of: ${schema.enum.join(', ')}` });
      return;
    }
  }
  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') {
        issues.push({ path, message: `must be a string (received ${describeType(value)})` });
        return;
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        issues.push({ path, message: `must be at least ${schema.minLength} characters` });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        issues.push({ path, message: `must be at most ${schema.maxLength} characters` });
      }
      return;
    }
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ path, message: `must be a number (received ${describeType(value)})` });
        return;
      }
      if (schema.type === 'integer' && !Number.isInteger(value)) {
        issues.push({ path, message: 'must be an integer' });
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        issues.push({ path, message: `must be >= ${schema.minimum}` });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        issues.push({ path, message: `must be <= ${schema.maximum}` });
      }
      return;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        issues.push({ path, message: `must be a boolean (received ${describeType(value)})` });
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        issues.push({ path, message: `must be an array (received ${describeType(value)})` });
        return;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        issues.push({ path, message: `must have at least ${schema.minItems} items` });
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        issues.push({ path, message: `must have at most ${schema.maxItems} items` });
      }
      if (schema.items !== undefined) {
        value.forEach((item, index) => {
          validateValue(schema.items as ToolParameterType, item, `${path}[${index}]`, issues);
        });
      }
      return;
    }
    case 'object': {
      validateObject(schema, value, path, issues);
      return;
    }
    default: {
      issues.push({ path, message: 'unsupported schema type' });
    }
  }
}

function validateObject(
  schema: ToolParameterType,
  value: unknown,
  path: string,
  issues: SchemaIssue[],
): void {
  if (!isPlainObject(value)) {
    issues.push({ path, message: `must be an object (received ${describeType(value)})` });
    return;
  }
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];
  for (const key of required) {
    if (!(key in value)) {
      issues.push({ path: `${path}.${key}`, message: 'is required' });
    }
  }
  const additionalAllowed = schema.additionalProperties === true;
  for (const key of Object.keys(value)) {
    if (!(key in properties)) {
      if (!additionalAllowed) {
        issues.push({ path: `${path}.${key}`, message: 'unknown field is not allowed' });
      }
      continue;
    }
    validateValue(properties[key] as ToolParameterType, value[key], `${path}.${key}`, issues);
  }
}

/** Validates an argument object against a tool parameter schema. */
export function validateToolArguments(
  schema: ToolParameterSchema,
  value: unknown,
): SchemaValidation {
  const issues: SchemaIssue[] = [];
  validateObject(schema, value, '$', issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as Readonly<Record<string, unknown>> };
}

export function formatIssues(issues: readonly SchemaIssue[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => `${issue.path} ${issue.message}`)
    .join('; ');
}
