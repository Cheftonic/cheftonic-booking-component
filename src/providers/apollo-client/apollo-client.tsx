import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { ApolloLink } from 'apollo-link';

/*
import { withClientState } from 'apollo-link-state';
import { ViewPage } from '../../models/last-view-page.model'
import gql from 'graphql-tag'

export const getLastViewPage = gqlll`
      query getLastViewPage {
        lastViewPage @client {
          __typename
          lastViewPage
          pageData
        }
      }
    `
*/

export class ApolloClientProvider {

  apollo: ApolloClient <NormalizedCacheObject>;

  public getApolloClient(): ApolloClient<NormalizedCacheObject> {
    if (! this.apollo) {
      this.initApollo();
    }
    return this.apollo;
  }

  public initApollo () {
    console.log('Hello ApolloClientProvider INIT');

    const cache = new InMemoryCache ({
      // fragmentMatcher: // matcher,
      dataIdFromObject: (object: any) => {
        // TODO: Probably will be down to the object property which ends with '_id'
        switch (object.__typename) {
          case 'Person': return object.p_id;
          case 'Business': return object.b_id;
          case 'Restaurant': return object.b_r_id;
          case 'Customer': return object.email;
          case 'MasterData': return object.opt_id + '.' + object.lang;
          // default: return object.id || object._id;
        }
      },
      addTypename: true,
      // cacheResolvers: // cache resolvers
    }).restore({});

    const httpLink = new HttpLink ({ 
       uri: 'https://apidev.cheftonic.com/dev/chftqry'
      // uri: 'http://localhost:3000/chftqry' 
    });


    const cleanTypenameLink = new ApolloLink((operation, forward) => {
      if (operation.variables) {
        operation.variables = this.omitDeep (operation.variables, '__typename');
      }
      return forward(operation).map((data) => {
        return data;
      });
    });

    /*const stateLink = withClientState({
      cache,
      resolvers: {
        Query: {
          // provide initial state
          lastViewPage: () => <ViewPage> {
            __typename: 'LastViewPage',
            lastViewPage: 'page-restaurants',
            pageData: {}
          },
        },
        Mutation: {
          updateLastViewPage: (_, { page, pageData }, { cache }) => {
            cache.writeQuery({
              query: getLastViewPage,
              data: {
                lastViewPage: page,
                pageData: JSON.stringify(pageData)
              },
            })
            return cache.readQuery ({ query: getLastViewPage })
          },
        },
      },
    });*/

    const cheftonicLink = ApolloLink.from ([
      cleanTypenameLink,
      // stateLink,
      httpLink
    ]);

    this.apollo = new ApolloClient<NormalizedCacheObject> ({
      link: cheftonicLink,
      cache: cache
    });

  }

  private omitDeep(obj, key) {
    const keys = Object.keys(obj);
    const newObj = {};
    keys.forEach((i) => {
      if (i !== key) {
        const val = obj[i];
        if (Array.isArray(val)) newObj[i] = this.omitDeepArrayWalk(val, key);
        else if (typeof val === 'object' && val !== null) newObj[i] = this.omitDeep(val, key);
        else newObj[i] = val;
      }
    });
    return newObj;
  }

  private omitDeepArrayWalk(arr, key) {
    return arr.map((val) => {
      if (Array.isArray(val)) return this.omitDeepArrayWalk(val, key);
      else if (typeof val === 'object') return this.omitDeep(val, key);
      return val;
    });
  }
}
