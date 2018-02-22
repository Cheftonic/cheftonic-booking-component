import { Observable } from 'rxjs';

import { ApolloClientProvider } from '../providers';
import gql from 'graphql-tag';
import { MasterDataQuery, MasterDataQueryVariables } from '../../__generated__';

export enum MasterDataKeys {
  WEEKDAYS = 'weekdays',
  MONTHS = 'months',
  BOOKING_STATUS = 'booking_status'
}

const MasterData = gql`
query MasterData ($opt_id:String!, $lang:String!) {
  getMasterDataKey (opt_id:$opt_id, lang:$lang) {
    opt_id,
    lang,
    value
  }
}`
;

export class MasterDataProvider {

  constructor(public _apolloProvider: ApolloClientProvider) {
    console.log('Hello MasterDataProvider Provider');
  }

  public getMasterDataInfo (masterDataKey: MasterDataKeys): Observable<any> {
    return  Observable.create(
      this._apolloProvider.getApolloClient().watchQuery <MasterDataQuery>  ({
        query: MasterData,
        variables: <MasterDataQueryVariables> {
          opt_id: masterDataKey,
          lang: this.getLocale()
        }
      })
      .result()
      .then (({data}) => {
          return JSON.parse(data.getMasterDataKey.value);
      })
    )
  }

  private getLocale() {
    let userLang = navigator.language.split('-')[0];
    userLang = /(es|en)/gi.test(userLang) ? userLang : 'en';
    return userLang;
  }

}
