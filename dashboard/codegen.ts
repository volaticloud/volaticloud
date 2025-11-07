import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'http://localhost:8080/query',
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
