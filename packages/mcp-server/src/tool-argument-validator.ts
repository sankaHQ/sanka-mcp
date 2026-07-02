import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import { McpTool, ToolCallResult } from './types';

/**
 * Marker recorded as `error_type` on argument-validation failures so downstream
 * normalization can mark the failure as non-retryable and point the model at
 * fixing its arguments instead of retrying the same call.
 */
export const INVALID_TOOL_ARGUMENTS_ERROR_TYPE = 'InvalidToolArgumentsError';

const MAX_REPORTED_VIOLATIONS = 20;

// The tool input schemas are hand-written draft-07-style JSON schemas.
// Keep ajv permissive so nonstandard keywords or unregistered formats in
// existing schemas never throw at compile time, and never coerce argument
// types so the handlers see exactly what the client sent.
const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
  strict: false,
  validateFormats: false,
});

const validatorsByToolName = new Map<string, ValidateFunction | null>();

const compileValidator = (mcpTool: McpTool): ValidateFunction | null => {
  try {
    return ajv.compile(mcpTool.tool.inputSchema as Record<string, unknown>);
  } catch {
    // A schema ajv cannot compile must not take the tool offline; fall back to
    // the handler's own argument handling for that tool only.
    return null;
  }
};

const getValidator = (mcpTool: McpTool): ValidateFunction | null => {
  const toolName = mcpTool.tool.name;
  const cached = validatorsByToolName.get(toolName);
  if (cached !== undefined) {
    return cached;
  }
  const validator = compileValidator(mcpTool);
  validatorsByToolName.set(toolName, validator);
  return validator;
};

/**
 * Reports whether the tool's input schema compiles into a runtime validator.
 * Exposed so tests can assert every registered tool is actually validated
 * rather than silently falling back to handler-side argument handling.
 */
export const canValidateToolArguments = (mcpTool: McpTool): boolean => getValidator(mcpTool) !== null;

const formatViolation = (error: ErrorObject): string =>
  `${error.instancePath || '(root)'} ${error.message ?? 'is invalid'}`;

const formatViolations = (errors: ErrorObject[] | null | undefined): string[] => {
  const violations = [...new Set((errors ?? []).map(formatViolation))];
  if (violations.length <= MAX_REPORTED_VIOLATIONS) {
    return violations;
  }
  return [
    ...violations.slice(0, MAX_REPORTED_VIOLATIONS),
    `… ${violations.length - MAX_REPORTED_VIOLATIONS} more violations omitted`,
  ];
};

export const buildInvalidToolArgumentsResult = (toolName: string, violations: string[]): ToolCallResult => {
  const message = `Invalid arguments for ${toolName}: ${violations.join('; ')}`;
  return {
    content: [
      {
        type: 'text',
        text: `Tool execution failed: ${message}. Fix the listed arguments to match the tool input schema, then call the tool again. Do not retry with the same arguments.`,
      },
    ],
    isError: true,
    structuredContent: {
      ok: false,
      status: 'invalid_arguments',
      status_code: 400,
      message,
      error_type: INVALID_TOOL_ARGUMENTS_ERROR_TYPE,
      validation_errors: violations,
    },
  };
};

/**
 * Validates tool-call arguments against the tool's declared input schema.
 * Returns undefined when the arguments are valid (or the schema cannot be
 * compiled), otherwise an MCP error result describing every violation.
 *
 * Validators are compiled lazily and cached per tool name so repeated calls
 * to the same tool never recompile the schema.
 */
export const validateToolArguments = ({
  mcpTool,
  args,
}: {
  mcpTool: McpTool;
  args: Record<string, unknown> | undefined;
}): ToolCallResult | undefined => {
  const validator = getValidator(mcpTool);
  if (!validator || validator(args ?? {})) {
    return undefined;
  }
  return buildInvalidToolArgumentsResult(mcpTool.tool.name, formatViolations(validator.errors));
};
