import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetStrategiesQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
}>;


export type GetStrategiesQuery = { __typename?: 'Query', strategies: { __typename?: 'StrategyConnection', totalCount: number, edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, description?: string | null, code: string, version: string, config?: Record<string, any> | null, createdAt: string, bots: { __typename?: 'BotConnection', totalCount: number } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type CreateStrategyMutationVariables = Types.Exact<{
  input: Types.CreateStrategyInput;
}>;


export type CreateStrategyMutation = { __typename?: 'Mutation', createStrategy: { __typename?: 'Strategy', id: string, name: string, description?: string | null, code: string, version: string, config?: Record<string, any> | null } };

export type UpdateStrategyMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateStrategyInput;
}>;


export type UpdateStrategyMutation = { __typename?: 'Mutation', updateStrategy: { __typename?: 'Strategy', id: string, name: string, description?: string | null, code: string, version: string, config?: Record<string, any> | null } };

export type DeleteStrategyMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteStrategyMutation = { __typename?: 'Mutation', deleteStrategy: boolean };


export const GetStrategiesDocument = gql`
    query GetStrategies($first: Int, $after: Cursor) {
  strategies(first: $first, after: $after) {
    edges {
      node {
        id
        name
        description
        code
        version
        config
        createdAt
        bots {
          totalCount
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
    `;

/**
 * __useGetStrategiesQuery__
 *
 * To run a query within a React component, call `useGetStrategiesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategiesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategiesQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetStrategiesQuery(baseOptions?: Apollo.QueryHookOptions<GetStrategiesQuery, GetStrategiesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategiesQuery, GetStrategiesQueryVariables>(GetStrategiesDocument, options);
      }
export function useGetStrategiesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategiesQuery, GetStrategiesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategiesQuery, GetStrategiesQueryVariables>(GetStrategiesDocument, options);
        }
export function useGetStrategiesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategiesQuery, GetStrategiesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategiesQuery, GetStrategiesQueryVariables>(GetStrategiesDocument, options);
        }
export type GetStrategiesQueryHookResult = ReturnType<typeof useGetStrategiesQuery>;
export type GetStrategiesLazyQueryHookResult = ReturnType<typeof useGetStrategiesLazyQuery>;
export type GetStrategiesSuspenseQueryHookResult = ReturnType<typeof useGetStrategiesSuspenseQuery>;
export type GetStrategiesQueryResult = Apollo.QueryResult<GetStrategiesQuery, GetStrategiesQueryVariables>;
export const CreateStrategyDocument = gql`
    mutation CreateStrategy($input: CreateStrategyInput!) {
  createStrategy(input: $input) {
    id
    name
    description
    code
    version
    config
  }
}
    `;
export type CreateStrategyMutationFn = Apollo.MutationFunction<CreateStrategyMutation, CreateStrategyMutationVariables>;

/**
 * __useCreateStrategyMutation__
 *
 * To run a mutation, you first call `useCreateStrategyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateStrategyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createStrategyMutation, { data, loading, error }] = useCreateStrategyMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateStrategyMutation(baseOptions?: Apollo.MutationHookOptions<CreateStrategyMutation, CreateStrategyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateStrategyMutation, CreateStrategyMutationVariables>(CreateStrategyDocument, options);
      }
export type CreateStrategyMutationHookResult = ReturnType<typeof useCreateStrategyMutation>;
export type CreateStrategyMutationResult = Apollo.MutationResult<CreateStrategyMutation>;
export type CreateStrategyMutationOptions = Apollo.BaseMutationOptions<CreateStrategyMutation, CreateStrategyMutationVariables>;
export const UpdateStrategyDocument = gql`
    mutation UpdateStrategy($id: ID!, $input: UpdateStrategyInput!) {
  updateStrategy(id: $id, input: $input) {
    id
    name
    description
    code
    version
    config
  }
}
    `;
export type UpdateStrategyMutationFn = Apollo.MutationFunction<UpdateStrategyMutation, UpdateStrategyMutationVariables>;

/**
 * __useUpdateStrategyMutation__
 *
 * To run a mutation, you first call `useUpdateStrategyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateStrategyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateStrategyMutation, { data, loading, error }] = useUpdateStrategyMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateStrategyMutation(baseOptions?: Apollo.MutationHookOptions<UpdateStrategyMutation, UpdateStrategyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateStrategyMutation, UpdateStrategyMutationVariables>(UpdateStrategyDocument, options);
      }
export type UpdateStrategyMutationHookResult = ReturnType<typeof useUpdateStrategyMutation>;
export type UpdateStrategyMutationResult = Apollo.MutationResult<UpdateStrategyMutation>;
export type UpdateStrategyMutationOptions = Apollo.BaseMutationOptions<UpdateStrategyMutation, UpdateStrategyMutationVariables>;
export const DeleteStrategyDocument = gql`
    mutation DeleteStrategy($id: ID!) {
  deleteStrategy(id: $id)
}
    `;
export type DeleteStrategyMutationFn = Apollo.MutationFunction<DeleteStrategyMutation, DeleteStrategyMutationVariables>;

/**
 * __useDeleteStrategyMutation__
 *
 * To run a mutation, you first call `useDeleteStrategyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteStrategyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteStrategyMutation, { data, loading, error }] = useDeleteStrategyMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteStrategyMutation(baseOptions?: Apollo.MutationHookOptions<DeleteStrategyMutation, DeleteStrategyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteStrategyMutation, DeleteStrategyMutationVariables>(DeleteStrategyDocument, options);
      }
export type DeleteStrategyMutationHookResult = ReturnType<typeof useDeleteStrategyMutation>;
export type DeleteStrategyMutationResult = Apollo.MutationResult<DeleteStrategyMutation>;
export type DeleteStrategyMutationOptions = Apollo.BaseMutationOptions<DeleteStrategyMutation, DeleteStrategyMutationVariables>;