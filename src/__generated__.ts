/* tslint:disable */
//  This file was automatically generated and should not be edited.

export interface BookRequestInput {
  b_r_id: string,
  book_id?: string | null,
  p_id?: string | null,
  curr_ver?: number | null,
  channel: string,
  book_date: string,
  made_on: string,
  status?: string | null,
  num_pax: number,
  special_need?: Array< string | null > | null,
  notes?: string | null,
  floorplan?: string | null,
  rest_area?: string | null,
  service: string,
  table?: string | null,
  food_order?: Array< string | null > | null,
  person?: PersonInput | null,
};

export interface PersonInput {
  p_id?: string | null,
  email?: Array< string | null > | null,
  phone?: string | null,
  name?: string | null,
  surname?: string | null,
  birthdate?: string | null,
  gender?: string | null,
  def_address?: AddressDetailInput | null,
  addresses?: Array< AddressDetailInput | null > | null,
};

export interface AddressDetailInput {
  country: string,
  region: string,
  city: string,
  street: string,
  num?: number | null,
  post_code?: string | null,
  ext_info?: string | null,
  lat?: number | null,
  lng?: number | null,
  parking?: string | null,
  public_transport?: string | null,
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
  booking_info: BookRequestInput,
};

export interface BookRequestMutation {
  // This is for users creating their book requests
  createMyBookRequest:  {
    // bookRequest ID
    book_id: string,
    book_date: string,
    made_on: string,
    status: string,
    num_pax: number,
    notes: string | null,
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
