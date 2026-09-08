// Generated from sanka-api PublicMappingField.model_json_schema(by_alias=True); local refs expanded.
export const migrationMappingFieldSchema = {
  additionalProperties: false,
  properties: {
    sourceField: {
      title: 'Sourcefield',
      type: 'string',
    },
    targetObject: {
      title: 'Targetobject',
      type: 'string',
    },
    targetField: {
      title: 'Targetfield',
      type: 'string',
    },
    sourceType: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Sourcetype',
    },
    targetType: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Targettype',
    },
    transformRule: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Transformrule',
    },
    required: {
      default: false,
      title: 'Required',
      type: 'boolean',
    },
    identity: {
      anyOf: [
        {
          type: 'boolean',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Identity',
    },
    mappingKind: {
      default: 'scalar',
      enum: ['scalar', 'owner', 'relationship', 'reference'],
      title: 'Mappingkind',
      type: 'string',
    },
    sourceReferenceObject: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Sourcereferenceobject',
    },
    targetReferenceObject: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Targetreferenceobject',
    },
    relationshipMode: {
      anyOf: [
        {
          enum: ['default', 'single', 'collection'],
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Relationshipmode',
    },
    associationCategory: {
      anyOf: [
        {
          enum: ['HUBSPOT_DEFINED', 'USER_DEFINED', 'INTEGRATOR_DEFINED'],
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Associationcategory',
    },
    associationTypeId: {
      anyOf: [
        {
          exclusiveMinimum: 0,
          type: 'integer',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Associationtypeid',
    },
    sourceFilter: {
      anyOf: [
        {
          additionalProperties: false,
          description: 'A reviewed source-side predicate that defines one migration route.',
          properties: {
            field: {
              title: 'Field',
              type: 'string',
            },
            operator: {
              const: 'equals',
              default: 'equals',
              title: 'Operator',
              type: 'string',
            },
            value: {
              title: 'Value',
              type: 'boolean',
            },
          },
          required: ['field', 'value'],
          title: 'FerrySourceFilter',
          type: 'object',
        },
        {
          type: 'null',
        },
      ],
      default: null,
    },
    valueMap: {
      items: {
        additionalProperties: false,
        description: 'One reviewed source-record predicate and its destination scalar value.',
        properties: {
          when: {
            additionalProperties: {
              anyOf: [
                {
                  type: 'string',
                },
                {
                  type: 'integer',
                },
                {
                  type: 'number',
                },
                {
                  type: 'boolean',
                },
              ],
            },
            maxProperties: 20,
            minProperties: 1,
            title: 'When',
            type: 'object',
          },
          value: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'integer',
              },
              {
                type: 'number',
              },
              {
                type: 'boolean',
              },
            ],
            title: 'Value',
          },
        },
        required: ['when', 'value'],
        title: 'FerryValueMapEntry',
        type: 'object',
      },
      maxItems: 2000,
      title: 'Valuemap',
      type: 'array',
    },
    unmappedValuePolicy: {
      default: 'error',
      enum: ['error', 'preserve', 'omit'],
      title: 'Unmappedvaluepolicy',
      type: 'string',
    },
    origin: {
      anyOf: [
        {
          enum: ['candidate', 'operator', 'ai'],
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      default: null,
      title: 'Origin',
    },
  },
  required: ['sourceField', 'targetObject', 'targetField'],
  title: 'PublicMappingField',
  type: 'object',
};
