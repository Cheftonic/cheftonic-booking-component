/* tslint:disable */
//  This file was automatically generated and should not be edited.

export interface ExtBookRequestInput {
  b_r_id: string,
  book_date: string,
  made_on: string,
  reminder_sent?: string | null,
  num_pax: number,
  notes?: string | null,
  contact_info?: BookRequestContactInfoInput | null,
  service: string,
  channel: string,
};

export interface BookRequestContactInfoInput {
  name?: string | null,
  surname?: string | null,
  email?: string | null,
  phone?: string | null,
};

export interface RestaurantBookingInfoQueryVariables {
  b_r_id: string,
};

export interface RestaurantBookingInfoQuery {
  getRestaurantById:  {
    b_r_id: string,
    opening:  {
      from: string | null,
      to: string | null,
      open_weekdays: Array< string > | null,
      closing_days: Array< string | null > | null,
    } | null,
    services:  Array< {
      rs_id: string,
      name: string,
      is_active: boolean,
      date_range: Array< string | null > | null,
      open_weekdays: Array< string | null > | null,
      starts_at: string | null,
      ends_at: string | null,
      booking_config:  {
        online_allowed: number,
        booking_freq: string | null,
        booking_duration: string | null,
        in_advance_booking: string | null,
        prepayment: boolean | null,
        prepayment_min_pax: number | null,
        prepayment_pax_charge: number | null,
        no_show: boolean | null,
        no_show_charge: number | null,
        no_show_min_pax: number | null,
        no_show_max_pax: number | null,
        in_advance_cancellation: number | null,
      } | null,
    } > | null,
  } | null,
};

export interface RestaurantSpecialOpeningsToSixMonthsQueryVariables {
  b_r_id: string,
  month?: number | null,
  year?: number | null,
};

export interface RestaurantSpecialOpeningsToSixMonthsQuery {
  getRestaurantById:  {
    b_r_id: string,
    special_openings:  Array< {
      so_id: string,
      open_weekdays: Array< string | null >,
      from: string,
      to: string | null,
      services:  Array< {
        name: string,
        is_active: boolean,
        open_weekdays: Array< string | null > | null,
        starts_at: string | null,
        ends_at: string | null,
        booking_config:  {
          online_allowed: number,
          booking_freq: string | null,
          booking_duration: string | null,
          in_advance_booking: string | null,
          prepayment: boolean | null,
          prepayment_min_pax: number | null,
          prepayment_pax_charge: number | null,
          no_show: boolean | null,
          no_show_charge: number | null,
          no_show_min_pax: number | null,
          no_show_max_pax: number | null,
          in_advance_cancellation: number | null,
        } | null,
      } | null >,
    } | null > | null,
  } | null,
};

export interface BookRequestMutationVariables {
  booking_info: ExtBookRequestInput,
};

export interface BookRequestMutation {
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
  getMasterDataKey:  {
    opt_id: string,
    lang: string,
    value: string,
  } | null,
};
