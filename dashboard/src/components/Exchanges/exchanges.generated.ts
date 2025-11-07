import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetExchangesQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type GetExchangesQuery = { __typename?: 'Query', exchanges: Array<{ __typename?: 'Exchange', id: string, name: string, config?: Record<string, any> | null, createdAt: string, updatedAt: string, bots: { __typename?: 'BotConnection', totalCount: number } }> };

export type GetExchangeQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetExchangeQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Backtest' }
    | { __typename?: 'Bot' }
    | { __typename?: 'BotMetrics' }
    | { __typename?: 'BotRunner' }
    | { __typename?: 'Exchange', id: string, name: string, config?: Record<string, any> | null, createdAt: string, updatedAt: string, bots: { __typename?: 'BotConnection', totalCount: number, edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus } | null } | null> | null } }
    | { __typename?: 'Strategy' }
    | { __typename?: 'Trade' }
   | null };

export type CreateExchangeMutationVariables = Types.Exact<{
  input: Types.CreateExchangeInput;
}>;


export type CreateExchangeMutation = { __typename?: 'Mutation', createExchange: { __typename?: 'Exchange', id: string, name: string, config?: Record<string, any> | null } };

export type UpdateExchangeMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateExchangeInput;
}>;


export type UpdateExchangeMutation = { __typename?: 'Mutation', updateExchange: { __typename?: 'Exchange', id: string, name: string, config?: Record<string, any> | null } };

export type DeleteExchangeMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteExchangeMutation = { __typename?: 'Mutation', deleteExchange: boolean };


export const GetExchangesDocument = gql`
    query GetExchanges {
  exchanges {
    id
    name
    config
    createdAt
    updatedAt
    bots(first: 10) {
      totalCount
    }
  }
}
    `;

/**
 * __useGetExchangesQuery__
 *
 * To run a query within a React component, call `useGetExchangesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetExchangesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetExchangesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetExchangesQuery(baseOptions?: Apollo.QueryHookOptions<GetExchangesQuery, GetExchangesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetExchangesQuery, GetExchangesQueryVariables>(GetExchangesDocument, options);
      }
export function useGetExchangesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetExchangesQuery, GetExchangesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetExchangesQuery, GetExchangesQueryVariables>(GetExchangesDocument, options);
        }
export function useGetExchangesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetExchangesQuery, GetExchangesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetExchangesQuery, GetExchangesQueryVariables>(GetExchangesDocument, options);
        }
export type GetExchangesQueryHookResult = ReturnType<typeof useGetExchangesQuery>;
export type GetExchangesLazyQueryHookResult = ReturnType<typeof useGetExchangesLazyQuery>;
export type GetExchangesSuspenseQueryHookResult = ReturnType<typeof useGetExchangesSuspenseQuery>;
export type GetExchangesQueryResult = Apollo.QueryResult<GetExchangesQuery, GetExchangesQueryVariables>;
export const GetExchangeDocument = gql`
    query GetExchange($id: ID!) {
  node(id: $id) {
    ... on Exchange {
      id
      name
      config
      createdAt
      updatedAt
      bots(first: 50) {
        edges {
          node {
            id
            name
            status
          }
        }
        totalCount
      }
    }
  }
}
    `;

/**
 * __useGetExchangeQuery__
 *
 * To run a query within a React component, call `useGetExchangeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetExchangeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetExchangeQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetExchangeQuery(baseOptions: Apollo.QueryHookOptions<GetExchangeQuery, GetExchangeQueryVariables> & ({ variables: GetExchangeQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetExchangeQuery, GetExchangeQueryVariables>(GetExchangeDocument, options);
      }
export function useGetExchangeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetExchangeQuery, GetExchangeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetExchangeQuery, GetExchangeQueryVariables>(GetExchangeDocument, options);
        }
export function useGetExchangeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetExchangeQuery, GetExchangeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetExchangeQuery, GetExchangeQueryVariables>(GetExchangeDocument, options);
        }
export type GetExchangeQueryHookResult = ReturnType<typeof useGetExchangeQuery>;
export type GetExchangeLazyQueryHookResult = ReturnType<typeof useGetExchangeLazyQuery>;
export type GetExchangeSuspenseQueryHookResult = ReturnType<typeof useGetExchangeSuspenseQuery>;
export type GetExchangeQueryResult = Apollo.QueryResult<GetExchangeQuery, GetExchangeQueryVariables>;
export const CreateExchangeDocument = gql`
    mutation CreateExchange($input: CreateExchangeInput!) {
  createExchange(input: $input) {
    id
    name
    config
  }
}
    `;
export type CreateExchangeMutationFn = Apollo.MutationFunction<CreateExchangeMutation, CreateExchangeMutationVariables>;

/**
 * __useCreateExchangeMutation__
 *
 * To run a mutation, you first call `useCreateExchangeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateExchangeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createExchangeMutation, { data, loading, error }] = useCreateExchangeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateExchangeMutation(baseOptions?: Apollo.MutationHookOptions<CreateExchangeMutation, CreateExchangeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateExchangeMutation, CreateExchangeMutationVariables>(CreateExchangeDocument, options);
      }
export type CreateExchangeMutationHookResult = ReturnType<typeof useCreateExchangeMutation>;
export type CreateExchangeMutationResult = Apollo.MutationResult<CreateExchangeMutation>;
export type CreateExchangeMutationOptions = Apollo.BaseMutationOptions<CreateExchangeMutation, CreateExchangeMutationVariables>;
export const UpdateExchangeDocument = gql`
    mutation UpdateExchange($id: ID!, $input: UpdateExchangeInput!) {
  updateExchange(id: $id, input: $input) {
    id
    name
    config
  }
}
    `;
export type UpdateExchangeMutationFn = Apollo.MutationFunction<UpdateExchangeMutation, UpdateExchangeMutationVariables>;

/**
 * __useUpdateExchangeMutation__
 *
 * To run a mutation, you first call `useUpdateExchangeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateExchangeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateExchangeMutation, { data, loading, error }] = useUpdateExchangeMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateExchangeMutation(baseOptions?: Apollo.MutationHookOptions<UpdateExchangeMutation, UpdateExchangeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateExchangeMutation, UpdateExchangeMutationVariables>(UpdateExchangeDocument, options);
      }
export type UpdateExchangeMutationHookResult = ReturnType<typeof useUpdateExchangeMutation>;
export type UpdateExchangeMutationResult = Apollo.MutationResult<UpdateExchangeMutation>;
export type UpdateExchangeMutationOptions = Apollo.BaseMutationOptions<UpdateExchangeMutation, UpdateExchangeMutationVariables>;
export const DeleteExchangeDocument = gql`
    mutation DeleteExchange($id: ID!) {
  deleteExchange(id: $id)
}
    `;
export type DeleteExchangeMutationFn = Apollo.MutationFunction<DeleteExchangeMutation, DeleteExchangeMutationVariables>;

/**
 * __useDeleteExchangeMutation__
 *
 * To run a mutation, you first call `useDeleteExchangeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteExchangeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteExchangeMutation, { data, loading, error }] = useDeleteExchangeMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteExchangeMutation(baseOptions?: Apollo.MutationHookOptions<DeleteExchangeMutation, DeleteExchangeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteExchangeMutation, DeleteExchangeMutationVariables>(DeleteExchangeDocument, options);
      }
export type DeleteExchangeMutationHookResult = ReturnType<typeof useDeleteExchangeMutation>;
export type DeleteExchangeMutationResult = Apollo.MutationResult<DeleteExchangeMutation>;
export type DeleteExchangeMutationOptions = Apollo.BaseMutationOptions<DeleteExchangeMutation, DeleteExchangeMutationVariables>;