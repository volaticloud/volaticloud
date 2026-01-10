import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetStrategyForStudioQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetStrategyForStudioQuery = { __typename?: 'Query', strategies: { __typename?: 'StrategyConnection', edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, description?: string | null, code: string, versionNumber: number, isLatest: boolean, config: Record<string, any>, createdAt: string, updatedAt: string } | null } | null> | null } };

export type GetStrategyVersionsForStudioQueryVariables = Types.Exact<{
  name: Types.Scalars['String']['input'];
}>;


export type GetStrategyVersionsForStudioQuery = { __typename?: 'Query', strategyVersions: Array<{ __typename?: 'Strategy', id: string, name: string, versionNumber: number, isLatest: boolean, code: string, createdAt: string }> };


export const GetStrategyForStudioDocument = gql`
    query GetStrategyForStudio($id: ID!) {
  strategies(where: {id: $id}, first: 1) {
    edges {
      node {
        id
        name
        description
        code
        versionNumber
        isLatest
        config
        createdAt
        updatedAt
      }
    }
  }
}
    `;

/**
 * __useGetStrategyForStudioQuery__
 *
 * To run a query within a React component, call `useGetStrategyForStudioQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategyForStudioQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategyForStudioQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetStrategyForStudioQuery(baseOptions: Apollo.QueryHookOptions<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables> & ({ variables: GetStrategyForStudioQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>(GetStrategyForStudioDocument, options);
      }
export function useGetStrategyForStudioLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>(GetStrategyForStudioDocument, options);
        }
// @ts-ignore
export function useGetStrategyForStudioSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>;
export function useGetStrategyForStudioSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategyForStudioQuery | undefined, GetStrategyForStudioQueryVariables>;
export function useGetStrategyForStudioSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>(GetStrategyForStudioDocument, options);
        }
export type GetStrategyForStudioQueryHookResult = ReturnType<typeof useGetStrategyForStudioQuery>;
export type GetStrategyForStudioLazyQueryHookResult = ReturnType<typeof useGetStrategyForStudioLazyQuery>;
export type GetStrategyForStudioSuspenseQueryHookResult = ReturnType<typeof useGetStrategyForStudioSuspenseQuery>;
export type GetStrategyForStudioQueryResult = Apollo.QueryResult<GetStrategyForStudioQuery, GetStrategyForStudioQueryVariables>;
export const GetStrategyVersionsForStudioDocument = gql`
    query GetStrategyVersionsForStudio($name: String!) {
  strategyVersions(name: $name) {
    id
    name
    versionNumber
    isLatest
    code
    createdAt
  }
}
    `;

/**
 * __useGetStrategyVersionsForStudioQuery__
 *
 * To run a query within a React component, call `useGetStrategyVersionsForStudioQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategyVersionsForStudioQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategyVersionsForStudioQuery({
 *   variables: {
 *      name: // value for 'name'
 *   },
 * });
 */
export function useGetStrategyVersionsForStudioQuery(baseOptions: Apollo.QueryHookOptions<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables> & ({ variables: GetStrategyVersionsForStudioQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>(GetStrategyVersionsForStudioDocument, options);
      }
export function useGetStrategyVersionsForStudioLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>(GetStrategyVersionsForStudioDocument, options);
        }
// @ts-ignore
export function useGetStrategyVersionsForStudioSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>;
export function useGetStrategyVersionsForStudioSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategyVersionsForStudioQuery | undefined, GetStrategyVersionsForStudioQueryVariables>;
export function useGetStrategyVersionsForStudioSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>(GetStrategyVersionsForStudioDocument, options);
        }
export type GetStrategyVersionsForStudioQueryHookResult = ReturnType<typeof useGetStrategyVersionsForStudioQuery>;
export type GetStrategyVersionsForStudioLazyQueryHookResult = ReturnType<typeof useGetStrategyVersionsForStudioLazyQuery>;
export type GetStrategyVersionsForStudioSuspenseQueryHookResult = ReturnType<typeof useGetStrategyVersionsForStudioSuspenseQuery>;
export type GetStrategyVersionsForStudioQueryResult = Apollo.QueryResult<GetStrategyVersionsForStudioQuery, GetStrategyVersionsForStudioQueryVariables>;