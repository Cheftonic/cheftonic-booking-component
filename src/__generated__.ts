/* tslint:disable */
//  This file was automatically generated and should not be edited.

export interface ExtBookRequestInput {
  b_r_id: string,
  book_date: string,
  made_on: string,
  num_pax: number,
  notes?: string | null,
  phone: string,
  email: string,
  name: string,
  surname: string,
  service: string,
  channel: string,
};

export interface RestaurantBookingInfoQueryVariables {
  b_r_id: string,
};

export interface RestaurantBookingInfoQuery {
  // Restaurant
  getRestaurantById:  {
    // Business and restaurant IDs concatenated: b_id + "." + r_id
    b_r_id: string,
    opening:  {
      from: string | null,
      to: string | null,
      open_weekdays: Array< string > | null,
      closing_days: Array< string | null > | null,
    } | null,
    services:  Array< {
      // Restaurant Service Id
      rs_id: string,
      name: string,
      is_active: boolean,
      date_range: Array< string | null > | null,
      open_weekdays: Array< string | null > | null,
      starts_at: string | null,
      ends_at: string | null,
      booking_config:  {
        capacity: number | null,
        closing_time: string | null,
        in_advance: number | null,
        online_allowed: number | null,
        no_show_charge: number | null,
        min_pax: number | null,
        max_pax: number | null,
      } | null,
    } > | null,
  } | null,
};

export interface BookRequestMutationVariables {
  booking_info: ExtBookRequestInput,
};

export interface BookRequestMutation {
  // External Operation - Create book request
  createExtBookRequest:  {
    book_date: string,
    num_pax: number,
    restaurant:  {
      r_name: string,
    },
  } | null,
};

export interface MasterDataQueryVariables {
  opt_id: string,
  lang: string,
};

export interface MasterDataQuery {
  // MasterData
  getMasterDataKey:  {
    opt_id: string,
    lang: string,
    value: string,
  } | null,
};
