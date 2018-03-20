import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { ApolloLink } from 'apollo-link';

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
      dataIdFromObject: (object: any) => {
        switch (object.__typename) {
          case 'Restaurant': return object.b_r_id;
          case 'MasterData': return object.opt_id + '.' + object.lang;
        }
      },
      addTypename: true,
    }).restore({});

    const httpLink = new HttpLink ({
      // uri: 'http://localhost:3000/chftqry'
        uri: 'https://api.cheftonic.com/prod/chftqry'
    });


    const cleanTypenameLink = new ApolloLink((operation, forward) => {
      if (operation.variables) {
        operation.variables = this.omitDeep (operation.variables, '__typename');
      }
      return forward(operation).map((data) => {
        return data;
      });
    });

    const cheftonicLink = ApolloLink.from ([
      cleanTypenameLink,
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
