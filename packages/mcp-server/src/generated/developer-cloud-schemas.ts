// Generated from the maintained V2 Developer Cloud OpenAPI request schemas.
// Run scripts/sync-developer-cloud-contract.py; do not edit by hand.
export const developerCloudSchemas = {
  CertificateRevokeRequest: {
    properties: {
      reason: {
        type: 'string',
        maxLength: 500,
        minLength: 1,
        title: 'Reason',
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['reason'],
    title: 'CertificateRevokeRequest',
  },
  CertificationSpec: {
    properties: {
      parent_run_id: {
        type: 'string',
        format: 'uuid',
        title: 'Parent Run Id',
      },
      candidate_sha256: {
        type: 'string',
        pattern: '^[a-f0-9]{64}$',
        title: 'Candidate Sha256',
      },
      scenarios: {
        items: {
          $ref: '#/$defs/HttpScenario',
        },
        type: 'array',
        maxItems: 50,
        minItems: 1,
        title: 'Scenarios',
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['parent_run_id', 'candidate_sha256', 'scenarios'],
    title: 'CertificationSpec',
  },
  CloudRunRequest: {
    properties: {
      source_id: {
        type: 'string',
        format: 'uuid',
        title: 'Source Id',
      },
      source_sha256: {
        type: 'string',
        pattern: '^[a-f0-9]{64}$',
        title: 'Source Sha256',
      },
      max_credits: {
        type: 'integer',
        maximum: 8000.0,
        exclusiveMinimum: 0.0,
        title: 'Max Credits',
      },
      timeout_seconds: {
        type: 'integer',
        maximum: 3600.0,
        exclusiveMinimum: 0.0,
        title: 'Timeout Seconds',
        default: 3600,
      },
      recipe: {
        type: 'string',
        const: 'drf-to-fastapi',
        title: 'Recipe',
        default: 'drf-to-fastapi',
      },
      verification_profile: {
        type: 'string',
        enum: ['generated-tests-static-v1', 'independent-http-replay-v1'],
        title: 'DeveloperCloudCloudRunRequestPropertiesVerificationProfile',
        default: 'generated-tests-static-v1',
      },
      settings_module: {
        anyOf: [
          {
            type: 'string',
            maxLength: 200,
            pattern: '^[A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*$',
          },
          {
            type: 'null',
          },
        ],
        title: 'Settings Module',
      },
      rerun_of: {
        anyOf: [
          {
            type: 'string',
            format: 'uuid',
          },
          {
            type: 'null',
          },
        ],
        title: 'Rerun Of',
      },
      repair: {
        anyOf: [
          {
            $ref: '#/$defs/RepairSpec',
          },
          {
            type: 'null',
          },
        ],
      },
      certification: {
        anyOf: [
          {
            $ref: '#/$defs/CertificationSpec',
          },
          {
            type: 'null',
          },
        ],
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['source_id', 'source_sha256', 'max_credits'],
    title: 'CloudRunRequest',
  },
  FleetItemRequest: {
    properties: {
      key: {
        type: 'string',
        pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$',
        title: 'Key',
      },
      repository: {
        type: 'string',
        maxLength: 200,
        minLength: 1,
        pattern: '^[A-Za-z0-9][A-Za-z0-9._/-]*$',
        title: 'Repository',
      },
      revision: {
        type: 'string',
        pattern: '^(?:[a-f0-9]{40}|[a-f0-9]{64})$',
        title: 'Revision',
      },
      request: {
        $ref: '#/$defs/CloudRunRequest',
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['key', 'repository', 'revision', 'request'],
    title: 'FleetItemRequest',
  },
  FleetRequest: {
    properties: {
      items: {
        items: {
          $ref: '#/$defs/FleetItemRequest',
        },
        type: 'array',
        maxItems: 20,
        minItems: 1,
        title: 'Items',
      },
      max_credits: {
        type: 'integer',
        maximum: 160000.0,
        minimum: 1.0,
        title: 'Max Credits',
      },
      concurrency: {
        type: 'integer',
        maximum: 5.0,
        minimum: 1.0,
        title: 'Concurrency',
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['items', 'max_credits', 'concurrency'],
    title: 'FleetRequest',
  },
  FleetRetryRequest: {
    properties: {
      item_keys: {
        items: {
          type: 'string',
          pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$',
        },
        type: 'array',
        maxItems: 20,
        minItems: 1,
        title: 'Item Keys',
      },
      max_credits: {
        type: 'integer',
        maximum: 160000.0,
        minimum: 1.0,
        title: 'Max Credits',
      },
      concurrency: {
        type: 'integer',
        maximum: 5.0,
        minimum: 1.0,
        title: 'Concurrency',
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['item_keys', 'max_credits', 'concurrency'],
    title: 'FleetRetryRequest',
  },
  HttpScenario: {
    properties: {
      id: {
        type: 'string',
        pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$',
        title: 'Id',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        title: 'DeveloperCloudHttpScenarioPropertiesMethod',
      },
      path: {
        type: 'string',
        maxLength: 1000,
        minLength: 1,
        title: 'Path',
      },
      json_body: {
        $ref: '#/$defs/JsonValue',
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['id', 'method', 'path'],
    title: 'HttpScenario',
  },
  JsonValue: {},
  RepairSpec: {
    properties: {
      parent_run_id: {
        type: 'string',
        format: 'uuid',
        title: 'Parent Run Id',
      },
      candidate_sha256: {
        type: 'string',
        pattern: '^[a-f0-9]{64}$',
        title: 'Candidate Sha256',
      },
      target_gate: {
        type: 'string',
        enum: ['test', 'verify'],
        title: 'DeveloperCloudRepairSpecPropertiesTargetGate',
      },
      allowed_paths: {
        items: {
          type: 'string',
        },
        type: 'array',
        maxItems: 20,
        minItems: 1,
        title: 'Allowed Paths',
      },
      model_policy: {
        type: 'string',
        const: 'bounded-patch-v1',
        title: 'Model Policy',
        default: 'bounded-patch-v1',
      },
      max_attempts: {
        type: 'integer',
        const: 1,
        title: 'Max Attempts',
        default: 1,
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['parent_run_id', 'candidate_sha256', 'target_gate', 'allowed_paths'],
    title: 'RepairSpec',
  },
  SourceUploadRequest: {
    properties: {
      archive_base64: {
        type: 'string',
        maxLength: 11184812,
        minLength: 1,
        title: 'Archive Base64',
      },
      sha256: {
        type: 'string',
        pattern: '^[a-f0-9]{64}$',
        title: 'Sha256',
      },
      revision: {
        anyOf: [
          {
            type: 'string',
            pattern: '^(?:[a-f0-9]{40}|[a-f0-9]{64})$',
          },
          {
            type: 'null',
          },
        ],
        title: 'Revision',
      },
    },
    additionalProperties: false,
    type: 'object',
    required: ['archive_base64', 'sha256'],
    title: 'SourceUploadRequest',
  },
};
