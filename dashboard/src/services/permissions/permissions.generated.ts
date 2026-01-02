import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type CheckPermissionsQueryVariables = Types.Exact<{
  permissions: Array<Types.PermissionCheckInput> | Types.PermissionCheckInput;
}>;


export type CheckPermissionsQuery = { __typename?: 'Query', checkPermissions: Array<{ __typename?: 'PermissionCheckResult', resourceId: string, scope: string, granted: boolean }> };


export const CheckPermissionsDocument = gql`
    query CheckPermissions($permissions: [PermissionCheckInput!]!) {
  checkPermissions(permissions: $permissions) {
    resourceId
    scope
    granted
  }
}
    `;

/**
 * __useCheckPermissionsQuery__
 *
 * To run a query within a React component, call `useCheckPermissionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCheckPermissionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCheckPermissionsQuery({
 *   variables: {
 *      permissions: // value for 'permissions'
 *   },
 * });
 */
export function useCheckPermissionsQuery(baseOptions: Apollo.QueryHookOptions<CheckPermissionsQuery, CheckPermissionsQueryVariables> & ({ variables: CheckPermissionsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CheckPermissionsQuery, CheckPermissionsQueryVariables>(CheckPermissionsDocument, options);
      }
export function useCheckPermissionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CheckPermissionsQuery, CheckPermissionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CheckPermissionsQuery, CheckPermissionsQueryVariables>(CheckPermissionsDocument, options);
        }
export function useCheckPermissionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CheckPermissionsQuery, CheckPermissionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CheckPermissionsQuery, CheckPermissionsQueryVariables>(CheckPermissionsDocument, options);
        }
export type CheckPermissionsQueryHookResult = ReturnType<typeof useCheckPermissionsQuery>;
export type CheckPermissionsLazyQueryHookResult = ReturnType<typeof useCheckPermissionsLazyQuery>;
export type CheckPermissionsSuspenseQueryHookResult = ReturnType<typeof useCheckPermissionsSuspenseQuery>;
export type CheckPermissionsQueryResult = Apollo.QueryResult<CheckPermissionsQuery, CheckPermissionsQueryVariables>;