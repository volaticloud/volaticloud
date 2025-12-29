import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  // Use local schema files instead of remote endpoint (avoids auth issues)
  // scalars.graphql must be first to define Time, Map, Cursor before they're used
  schema: [
    '../internal/graph/scalars.graphql',
    '../internal/graph/ent.graphql',
    '../internal/graph/schema.graphqls'
  ],
  documents: ['src/**/*.graphql'],
  ignoreNoDocuments: true,
  generates: {
    // Generate shared types
    './src/generated/types.ts': {
      plugins: ['typescript'],
      config: {
        scalars: {
          Time: 'string',
          Cursor: 'string',
          Map: 'Record<string, any>'
        }
      }
    },
    // Generate per-component files next to .graphql files
    'src/': {
      preset: 'near-operation-file',
      presetConfig: {
        extension: '.generated.ts',
        baseTypesPath: 'generated/types.ts'
      },
      plugins: ['typescript-operations', 'typescript-react-apollo'],
      config: {
        withHooks: true,
        scalars: {
          Time: 'string',
          Cursor: 'string',
          Map: 'Record<string, any>'
        }
      }
    }
  }
};

export default config;
