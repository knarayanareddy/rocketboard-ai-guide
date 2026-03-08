import { TASK_OUTPUT_SCHEMAS, type FieldSchema } from "./output-schemas";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function checkType(value: unknown, expected: FieldSchema["type"]): boolean {
  if (expected === "any") return true;
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
  return typeof value === expected;
}

export function validateAIOutput(taskType: string, output: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Must be an object
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    return { valid: false, errors: ["AI output is not a JSON object"], warnings };
  }

  const obj = output as Record<string, unknown>;

  // 2. Check type field
  if (obj.type === "error") {
    // Validate against error schema
    const errorSchema = TASK_OUTPUT_SCHEMAS.error;
    for (const [key, schema] of Object.entries(errorSchema.requiredFields)) {
      if (schema.optional) continue;
      if (!(key in obj)) {
        errors.push(`Error response missing required field: "${key}"`);
      }
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  if (obj.type !== taskType) {
    errors.push(`Expected type "${taskType}" but got "${obj.type}"`);
  }

  // 3. Look up schema
  const schema = TASK_OUTPUT_SCHEMAS[taskType];
  if (!schema) {
    warnings.push(`No schema defined for task type "${taskType}"`);
    return { valid: true, errors, warnings };
  }

  // 4. Check required keys and types
  for (const [key, fieldSchema] of Object.entries(schema.requiredFields)) {
    if (!(key in obj)) {
      if (!fieldSchema.optional) {
        errors.push(`Missing required field: "${key}"`);
      }
      continue;
    }
    if (!checkType(obj[key], fieldSchema.type)) {
      errors.push(`Field "${key}" expected ${fieldSchema.type} but got ${Array.isArray(obj[key]) ? "array" : typeof obj[key]}`);
    }
  }

  // 5. Warn on unexpected top-level keys
  const knownKeys = new Set(Object.keys(schema.requiredFields));
  knownKeys.add("_raw"); // internal fallback key
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      warnings.push(`Unexpected field: "${key}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
