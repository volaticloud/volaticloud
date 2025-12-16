import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

export const createApolloClient = (graphqlUrl: string, getAccessToken?: () => string | undefined) => {
  const httpLink = new HttpLink({
    uri: graphqlUrl,
  });

  // Create auth link that adds token to headers
  const authLink = setContext((_, { headers }) => {
    const token = getAccessToken?.();
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  return new ApolloClient({
    link: ApolloLink.from([authLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // Strategies use relay-style pagination
            strategies: {
              keyArgs: ['where', 'orderBy'],
              merge(_existing, incoming) {
                return incoming;
              },
            },
            // Bots use relay-style pagination
            bots: {
              keyArgs: ['where', 'orderBy'],
              merge(_existing, incoming) {
                return incoming;
              },
            },
            // Backtests use relay-style pagination
            backtests: {
              keyArgs: ['where', 'orderBy'],
              merge(_existing, incoming) {
                return incoming;
              },
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'cache-first',
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
    },
  });
};
