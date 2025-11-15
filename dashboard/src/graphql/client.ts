import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

export const createApolloClient = (graphqlUrl: string) => {
  const httpLink = new HttpLink({
    uri: graphqlUrl,
  });

  return new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
    },
  });
};
