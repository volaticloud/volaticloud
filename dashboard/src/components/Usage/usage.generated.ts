import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetOrganizationUsageQueryVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
  start: Types.Scalars['Time']['input'];
  end: Types.Scalars['Time']['input'];
}>;


export type GetOrganizationUsageQuery = { __typename?: 'Query', organizationUsage?: { __typename?: 'ResourceUsageAggregation', id: string, resourceType: Types.ResourceUsageAggregationResourceType, resourceID: string, ownerID: string, runnerID: string, granularity: Types.ResourceUsageAggregationAggregationGranularity, bucketStart: string, bucketEnd: string, cpuCoreSeconds: number, cpuAvgPercent: number, cpuMaxPercent: number, memoryGBSeconds: number, memoryAvgBytes: number, memoryMaxBytes: number, networkRxBytes: number, networkTxBytes: number, blockReadBytes: number, blockWriteBytes: number, sampleCount: number } | null };

export type GetEstimatedCostQueryVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
  start: Types.Scalars['Time']['input'];
  end: Types.Scalars['Time']['input'];
}>;


export type GetEstimatedCostQuery = { __typename?: 'Query', estimatedCost: { __typename?: 'UsageCost', cpuCost: number, memoryCost: number, networkCost: number, storageCost: number, totalCost: number, currency: string } };

export type GetUsageDashboardQueryVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
  start: Types.Scalars['Time']['input'];
  end: Types.Scalars['Time']['input'];
}>;


export type GetUsageDashboardQuery = { __typename?: 'Query', organizationUsage?: { __typename?: 'ResourceUsageAggregation', id: string, cpuCoreSeconds: number, cpuAvgPercent: number, cpuMaxPercent: number, memoryGBSeconds: number, memoryAvgBytes: number, memoryMaxBytes: number, networkRxBytes: number, networkTxBytes: number, blockReadBytes: number, blockWriteBytes: number, sampleCount: number, bucketStart: string, bucketEnd: string } | null, estimatedCost: { __typename?: 'UsageCost', cpuCost: number, memoryCost: number, networkCost: number, storageCost: number, totalCost: number, currency: string } };


export const GetOrganizationUsageDocument = gql`
    query GetOrganizationUsage($ownerID: String!, $start: Time!, $end: Time!) {
  organizationUsage(ownerID: $ownerID, start: $start, end: $end) {
    id
    resourceType
    resourceID
    ownerID
    runnerID
    granularity
    bucketStart
    bucketEnd
    cpuCoreSeconds
    cpuAvgPercent
    cpuMaxPercent
    memoryGBSeconds
    memoryAvgBytes
    memoryMaxBytes
    networkRxBytes
    networkTxBytes
    blockReadBytes
    blockWriteBytes
    sampleCount
  }
}
    `;

/**
 * __useGetOrganizationUsageQuery__
 *
 * To run a query within a React component, call `useGetOrganizationUsageQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetOrganizationUsageQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetOrganizationUsageQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      start: // value for 'start'
 *      end: // value for 'end'
 *   },
 * });
 */
export function useGetOrganizationUsageQuery(baseOptions: Apollo.QueryHookOptions<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables> & ({ variables: GetOrganizationUsageQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>(GetOrganizationUsageDocument, options);
      }
export function useGetOrganizationUsageLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>(GetOrganizationUsageDocument, options);
        }
// @ts-ignore
export function useGetOrganizationUsageSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>): Apollo.UseSuspenseQueryResult<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>;
export function useGetOrganizationUsageSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>): Apollo.UseSuspenseQueryResult<GetOrganizationUsageQuery | undefined, GetOrganizationUsageQueryVariables>;
export function useGetOrganizationUsageSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>(GetOrganizationUsageDocument, options);
        }
export type GetOrganizationUsageQueryHookResult = ReturnType<typeof useGetOrganizationUsageQuery>;
export type GetOrganizationUsageLazyQueryHookResult = ReturnType<typeof useGetOrganizationUsageLazyQuery>;
export type GetOrganizationUsageSuspenseQueryHookResult = ReturnType<typeof useGetOrganizationUsageSuspenseQuery>;
export type GetOrganizationUsageQueryResult = Apollo.QueryResult<GetOrganizationUsageQuery, GetOrganizationUsageQueryVariables>;
export const GetEstimatedCostDocument = gql`
    query GetEstimatedCost($ownerID: String!, $start: Time!, $end: Time!) {
  estimatedCost(ownerID: $ownerID, start: $start, end: $end) {
    cpuCost
    memoryCost
    networkCost
    storageCost
    totalCost
    currency
  }
}
    `;

/**
 * __useGetEstimatedCostQuery__
 *
 * To run a query within a React component, call `useGetEstimatedCostQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetEstimatedCostQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetEstimatedCostQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      start: // value for 'start'
 *      end: // value for 'end'
 *   },
 * });
 */
export function useGetEstimatedCostQuery(baseOptions: Apollo.QueryHookOptions<GetEstimatedCostQuery, GetEstimatedCostQueryVariables> & ({ variables: GetEstimatedCostQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>(GetEstimatedCostDocument, options);
      }
export function useGetEstimatedCostLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>(GetEstimatedCostDocument, options);
        }
// @ts-ignore
export function useGetEstimatedCostSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>): Apollo.UseSuspenseQueryResult<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>;
export function useGetEstimatedCostSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>): Apollo.UseSuspenseQueryResult<GetEstimatedCostQuery | undefined, GetEstimatedCostQueryVariables>;
export function useGetEstimatedCostSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>(GetEstimatedCostDocument, options);
        }
export type GetEstimatedCostQueryHookResult = ReturnType<typeof useGetEstimatedCostQuery>;
export type GetEstimatedCostLazyQueryHookResult = ReturnType<typeof useGetEstimatedCostLazyQuery>;
export type GetEstimatedCostSuspenseQueryHookResult = ReturnType<typeof useGetEstimatedCostSuspenseQuery>;
export type GetEstimatedCostQueryResult = Apollo.QueryResult<GetEstimatedCostQuery, GetEstimatedCostQueryVariables>;
export const GetUsageDashboardDocument = gql`
    query GetUsageDashboard($ownerID: String!, $start: Time!, $end: Time!) {
  organizationUsage(ownerID: $ownerID, start: $start, end: $end) {
    id
    cpuCoreSeconds
    cpuAvgPercent
    cpuMaxPercent
    memoryGBSeconds
    memoryAvgBytes
    memoryMaxBytes
    networkRxBytes
    networkTxBytes
    blockReadBytes
    blockWriteBytes
    sampleCount
    bucketStart
    bucketEnd
  }
  estimatedCost(ownerID: $ownerID, start: $start, end: $end) {
    cpuCost
    memoryCost
    networkCost
    storageCost
    totalCost
    currency
  }
}
    `;

/**
 * __useGetUsageDashboardQuery__
 *
 * To run a query within a React component, call `useGetUsageDashboardQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUsageDashboardQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUsageDashboardQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      start: // value for 'start'
 *      end: // value for 'end'
 *   },
 * });
 */
export function useGetUsageDashboardQuery(baseOptions: Apollo.QueryHookOptions<GetUsageDashboardQuery, GetUsageDashboardQueryVariables> & ({ variables: GetUsageDashboardQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>(GetUsageDashboardDocument, options);
      }
export function useGetUsageDashboardLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>(GetUsageDashboardDocument, options);
        }
// @ts-ignore
export function useGetUsageDashboardSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>): Apollo.UseSuspenseQueryResult<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>;
export function useGetUsageDashboardSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>): Apollo.UseSuspenseQueryResult<GetUsageDashboardQuery | undefined, GetUsageDashboardQueryVariables>;
export function useGetUsageDashboardSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>(GetUsageDashboardDocument, options);
        }
export type GetUsageDashboardQueryHookResult = ReturnType<typeof useGetUsageDashboardQuery>;
export type GetUsageDashboardLazyQueryHookResult = ReturnType<typeof useGetUsageDashboardLazyQuery>;
export type GetUsageDashboardSuspenseQueryHookResult = ReturnType<typeof useGetUsageDashboardSuspenseQuery>;
export type GetUsageDashboardQueryResult = Apollo.QueryResult<GetUsageDashboardQuery, GetUsageDashboardQueryVariables>;