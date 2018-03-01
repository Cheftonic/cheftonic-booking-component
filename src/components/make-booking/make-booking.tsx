import { Component, Prop, State } from '@stencil/core';
import { ApolloClientProvider, MasterDataProvider } from '../../providers/providers';
import { MasterDataKeys } from '../../providers/master-data/master-data'
import gql from 'graphql-tag';

import { BookRequestInput, RestaurantBookingInfoQuery } from '../../__generated__';
import { Calendar, CalendarConfig } from './calendar';
import { HourMinuteConfig, MinutesInterval, HourMinute } from './hour-minute';

const RestaurantBookingInfo = gql`
query RestaurantBookingInfo ($b_r_id: ID!) {
  getRestaurantById (b_r_id: $b_r_id) {
    b_r_id
    opening {
      from
      to
      open_weekdays
      closing_days
    }
    services {
      rs_id
      name
      is_active
      date_range
      open_weekdays
      starts_at
      ends_at
      booking_config {
        capacity
        closing_time
        in_advance
        online_allowed
        no_show_charge
        min_pax
        max_pax
      }
    }
  }
}`;
// createBookRequest (book_request: BookRequestInput!): BookRequest

/*const CreateBookRequest = gql`
mutation BookRequest ($booking_info: BookRequestInput!) {
  createMyBookRequest (book_request: $booking_info) {
    book_id
    book_date
    made_on
    status
    num_pax
    notes
  }
}
`;*/

/**
 * Read the README file to know about component's functionality
 */
@Component({
  tag: 'make-booking',
  styleUrl: 'make-booking.css'
})
export class MakeBookingComponent {
  // The input object is the restaurant_id where the user wants to make the booking
  @Prop() restid: string = "b6a26c75-f280-4964-9659-534a51178e4f.0";

  // Internal object to represent the data of the booking
  bookingInfo: BookingInfo;

  userPhoneValid: Boolean = false;

  // There objects represents the restaurant info about openings and services available
  opening: any;
  services: Array<any>;

  // Decides what should be shown
  @State() showCalendar: boolean = false;
  @State() showTime: boolean = false;
  @State() showPax: boolean = false;

  localLocale;

  // Map representing the hours opened per day for a given restaurant, depending on the services
  openHoursPerDay: Map<string, DayHours>;

  // These objects are used to configure the calendar and the hour-minute components respectively
  @State() calendarConfig: CalendarConfig;
  hourMinuteConfig: HourMinuteConfig;
  showHourMinute: boolean;

  // States of the component
  booking_state: BookingStates;
  phone_required: boolean;

  // Restaurant load status
  restaurant_status: String;
  ok: String = 'OK';
  info_pending: String = 'pending';
  not_loaded: String = 'no_load';

  // Providers
  _apolloProvider: ApolloClientProvider;
  _masterDataProvider: MasterDataProvider;

  // Selectors
  _daySelector: Calendar;
  _timeSelector: HourMinute;

  constructor() {
    this._apolloProvider = new ApolloClientProvider();
    this._masterDataProvider = new MasterDataProvider(this._apolloProvider);

    this._daySelector = new Calendar(this._masterDataProvider,
      async (param) => {
        const selectedDay = param.pop();
        this.bookingInfo.day = selectedDay;
        await this.setHourMinuteConfigForDate (selectedDay);
        await this._timeSelector.setConfig (this.hourMinuteConfig);
        this.toggleCalendarShow();
        console.log ('MAKE-BOOKING SELECT DAY - ' + this.bookingInfo.day);
      }
      , async (param) => {
      console.log ('MAKE-BOOKING MONTH CHANGE - ' + param.toISOString());
      await this.setCalendarConfigFromDate(param);
      await this._daySelector.setConfig (this.calendarConfig);

      // Don't display the hourMinute component until some day is selected
      this.hourMinuteConfig = null;
      this.showHourMinute = false;
    });

    this._timeSelector = new HourMinute((param) => {
      this.bookingInfo.time = param;
      const [hour, minutes] = param.split(':');
      this.bookingInfo.day.setHours (+hour, +minutes, 0, 0);
      this.toggleTimeShow();
      console.log ('MAKE-BOOKING FULL TIME - ' + this.bookingInfo.day.toISOString());
    });

    // Initialize default booking setup
    this.bookingInfo = new BookingInfo();
    this.bookingInfo.pax = 2;
    const now = new Date();
    const in1Hour = new Date(now.setHours(now.getHours() + 1));
    this.bookingInfo.day = in1Hour;
    this.bookingInfo.time = in1Hour.getHours() + ':00';

    this.bookingInfo.phoneChanged = false;
    this.showHourMinute = false;

    this.booking_state = BookingStates.not_submitted;
    this.restaurant_status = this.not_loaded;
  }

  async componentWillLoad() {
    console.log ("Apollo client version: " + this._apolloProvider.getApolloClient().version);
    const restQuery = await this._apolloProvider.getApolloClient().query<RestaurantBookingInfoQuery> ({
      query: RestaurantBookingInfo,
      variables: {
        b_r_id: this.restid
      }
    })
    const restData = restQuery.data;
    // console.log ("Restaurant info retrieved: " + JSON.stringify(data, null, 2));
    if (restData.getRestaurantById.opening && restData.getRestaurantById.services && restData.getRestaurantById.services.length > 0) {
      // Fetch the data
      this.opening = restData.getRestaurantById.opening;
      this.services = restData.getRestaurantById.services;
      this.openHoursPerDay = new Map<string, DayHours>();

      // The calendar should start 1h 30 mins ahead of current time
      await this.setCalendarConfigFromDate (this.in1Hour30Minutes());

      await this._daySelector.setConfig (this.calendarConfig);

      await this.setHourMinuteConfigForDate (this.in1Hour30Minutes());

      const [hour, minutes] = this.hourMinuteConfig.initialValue.split(':');
      this.bookingInfo.day.setHours (+hour, +minutes, 0, 0);

      await this._timeSelector.setConfig (this.hourMinuteConfig);

      // The restaurant is loaded and ready to receive bookings
      this.restaurant_status = this.ok;
    } else {
      // There is no info about opening and/or services, mark it.
      this.restaurant_status = this.info_pending;
    }
  }

  private in1Hour30Minutes(): Date {
    const in1HourAnd30Minutes = new Date();
    in1HourAnd30Minutes.setHours (in1HourAnd30Minutes.getHours() + 1);
    in1HourAnd30Minutes.setMinutes (in1HourAnd30Minutes.getMinutes() + 30);
    return in1HourAnd30Minutes;
  }

  private async setCalendarConfigFromDate (initialDay: Date) {
    // Check if it's the current month, in which case it will start in 1hour 30 mins
    initialDay = (initialDay.getMonth() === new Date().getMonth()) ? this.in1Hour30Minutes() : initialDay;

      this.calendarConfig = {
        weekdaysEnabled: this.opening.open_weekdays,
        disabledDays: [], // await this.getDisabledDaysInMonth(initialDay),
        multiSelection: false,
        todayTomorrow: false,
        dateFrom: initialDay
      };

      // Don't display the hourMinute component until some day is selected
      this.hourMinuteConfig = null;
      this.showHourMinute = false;
  }

  private async setHourMinuteConfigForDate (date: Date) {
    const dayHours = await this.getOpeningHoursForDay (date);

    let newHourMinuteConfig:HourMinuteConfig = {
      interval: MinutesInterval.HALF,
      hourHeaderTranslateKey: 'BOOKING_COMPONENT.HOUR_TITLE',
      minuteHeaderTranslateKey: 'BOOKING_COMPONENT.MINUTE_TITLE'
    };
    if (dayHours.hours.length > 0) {
      const hoursArray = dayHours.hours.sort((a, b) => a - b).map (h => '0'.concat(h.toString()).slice(-2));
      newHourMinuteConfig.initialValue = hoursArray[0].concat (':00');
      newHourMinuteConfig.hoursToShow = hoursArray;
    } else {
      // This means that there are no available hours
      this.hourMinuteConfig.hoursToShow = [];
    }

    this.bookingInfo.time = newHourMinuteConfig.initialValue;
    this.hourMinuteConfig = newHourMinuteConfig;

    this.showHourMinute = true;
  }

  /**
   * Given a certain day, gives back the available hours for that day.
   * It should cache the already computed days in a map with the day as key.
   * @param day Day to be processed
   */
  private async getOpeningHoursForDay (day: Date): Promise<DayHours> {
    // But first we need to get some master data, so we need to wrap everything in a subscription to masterdata's observable result

    const dowMD = await this._masterDataProvider.getMasterDataInfo(MasterDataKeys.WEEKDAYS);

    return this._getOpeningHoursForDay (day, dowMD);
  }

  /**
   * Wrapper of getOpeningHoursForDay to share code between getOpeningHoursForDay and getDisabledDaysInMonth methods
   * @param day Day to be processed
   * @param dowMD Days of the week coming from the Master Data table
   */
  private _getOpeningHoursForDay (day: Date, dowMD: any): DayHours {
    // 1. Get the date in cheftonic format
    const cheftoDate: string = getCheftonicDate(day);

    // 1.1. Check if the day is already cached, and if so return the computed hours. First check if it's null
    if (this.openHoursPerDay.has(cheftoDate)) {
      // console.log ("getOpeningHoursForDay Returning: " + JSON.stringify (this.openHoursPerDay.get (cheftoDate), null, 2))
      return this.openHoursPerDay.get (cheftoDate);
    }

    // 2. Check if it's in the closing_days array, if so, return an empty array
    if (this.opening.closing_days && this.opening.closing_days.includes (cheftoDate)) {
      // console.log ("getOpeningHoursForDay Returning: " + JSON.stringify (<DayHours>{day: day, hours:[]}, null, 2))
      const dh:DayHours = {day: day, hours: []};
      return dh;
    }

    /*
    3. Filter the services according to the following:
      a. Services that are allowed to be booked online
      b. Services active in that particular weekday. If open_weekdays is not present, it means that is available all days.
      c. If the selected day is the current day, check the start and end service time.
    */
    const dow = dowMD[day.getDay()];
    // Check if the restaurant is open that day of week

    const serviceHoursAvailable = this.services.map (svc => {
      // (a.) Services that are allowed to be booked online
      // const bookOnlineFlag = (svc.booking_config.online_allowed) ? (svc.booking_config.online_allowed > 0) : true
      if (svc.booking_config.online_allowed) {
        // (b.) Services active in that particular weekday. If open_weekdays is not present, it means that is available all days.
        const dayOfWeekFlag = (svc.open_weekdays) ? (svc.open_weekdays.includes(dow.key)) : true;
        if (dayOfWeekFlag) {
          // First we do some common cases calculations to use them later
          const d = new Date();
          const startHour = parseInt (svc.starts_at.split(':')[0], 10);
          const endHour = parseInt (svc.ends_at.split(':')[0], 10);
          const numOfHours = endHour - startHour;

          if (d.toDateString() === day.toDateString()) {
            // (c.) If the selected day is the current day, check the start and end service time.
            // Find the current date plus 1 hour and 30 minutes (default minimum delay is 1 hour for booking)
            const in1HourAnd30Minutes = new Date();
            in1HourAnd30Minutes.setHours (in1HourAnd30Minutes.getHours() + 1);
            in1HourAnd30Minutes.setMinutes (in1HourAnd30Minutes.getMinutes() + 30);
            const todaysHour = in1HourAnd30Minutes.getHours();

            if (todaysHour <= startHour) {
              // The service hasn't started yet or it is starting, return all hours in the service
              return [...Array(numOfHours).keys()].map (x => x + startHour);
            } else if (todaysHour >= endHour) {
              // The service has finished or is about to finish, return empty array
              return [];
            } else {
              // The time is in between the service, get the hours remaining until it finishes
              const remainingHours = endHour - todaysHour;
              return [...Array(remainingHours).keys()].map (x => x + todaysHour);
            }
          } else {
            // It is not today, return all available hours for this service
            return [...Array(numOfHours).keys()].map (x => x + startHour);
          }
        } else {
          // dayOfWeekFlag false
          return [];
        }
      } else {
        // bookOnlineFlag false
        return [];
      }
    })
    .reduce ((prev, curr) => {
      const res = prev.concat(curr);
      return res;
    });
    const res:DayHours = {day: day, hours: serviceHoursAvailable};
    // put it on the map to cache it
    this.openHoursPerDay.set (cheftoDate, res);

    return res;
  }

  setPax(event) {
    this.bookingInfo.pax = event.target.value;
    this.togglePaxShow();
  }

  toggleCalendarShow() {
    this.showCalendar = !this.showCalendar;
  }

  toggleTimeShow() {
    this.showTime = !this.showTime;
  }

  togglePaxShow() {
    this.showPax = !this.showPax;
  }

  onPhoneChange() {
    this.bookingInfo.phoneChanged = true;
    this.userPhoneValid = new RegExp(/^[0-9]{9,9}$/).test(this.bookingInfo.phone);
  }

  submitBooking() {
    if ((this.phone_required && this.userPhoneValid) || (! this.phone_required)) {
      // Check if the phone has been filled correctly
      this.booking_state = BookingStates.submitting;
      // Constant to calculate the service beign booked
      const bookHour = this.bookingInfo.time.split(':')[0];
      // Build the BookingInput object
      const bookRequestInput:BookRequestInput = {
        b_r_id : this.restid,
        // p_id: this.user.person.p_id,
        made_on: new Date().toISOString(),
        book_date: this.bookingInfo.day.toISOString(),
        notes: this.bookingInfo.notes,
        num_pax: this.bookingInfo.pax,
        channel: 'external_web',
        service: this.services.find ((service) => (bookHour >= service.starts_at && bookHour < service.ends_at)).rs_id
      };

      console.log ('Submitting booking info: ' + JSON.stringify(bookRequestInput,null,2));

      /*this._apolloProvider.getApolloClient().mutate<BookRequestInput> ({
        mutation: CreateBookRequest,
        variables: {
          booking_info: bookRequestInput
        }
      }).then (() => {
        this.booking_state = BookingStates.submitted_ok;
        console.log ('Booking submitted successfully');

      }, error => {
        this.booking_state = BookingStates.submitted_ko;
        console.log ('Booking submitted with errors: ' + error);
      });*/
    }
  }

  handlePhoneChange(event) {
    this.bookingInfo.phone = event.target.value;
    if (event.target.validity.typeMismatch) {
      console.log('this element is not valid')
    }
  }

  handleEmailChange(event) {
    this.bookingInfo.email = event.target.value;
  }

  handleNotesChange(event) {
    this.bookingInfo.notes = event.target.value;
  }

  render () {
    return (
      <div class="cheftonic-booking-wrapper">
        <div class="cheftonic-booking-container">
          <div class="submit-booking-col" onClick = {this.togglePaxShow.bind(this)}>
            <span>{ this.bookingInfo.pax }</span>
          </div>
          <div class="submit-booking-col" onClick = {this.toggleCalendarShow.bind(this)}>
              <label class="booking-bar-date">{ this.bookingInfo.day.toDateString() }</label>
          </div>
          <div class="submit-booking-col" onClick = {this.toggleTimeShow.bind(this)}>
            <label class="booking-bar-Time">{ this.bookingInfo.time }</label>
          </div>
        </div>

        {(this.showCalendar) ?
          <div id="booking-cal-container" class="calendar-container">
            { this._daySelector.renderCalendar() }
          </div>
          : <div></div>
        }

        {(this.showTime) ?
          <div id="booking-time-container" class="time-container" style={{display: 'block'}}>
            <div class="time_box">
              { this._timeSelector.renderHourMinute() }
            </div>
          </div>
          :<div></div>
        }

        {(this.showPax) ?
          <div id="booking-pax-container" class="people-container" style={{display: 'block'}}>
            <div class="people_box">
              <ul class="pax-list">
                {[1,2,3,4,5,6,7,8,9,10].map(paxNr =>
                    <li class="item" value={paxNr} onClick = {this.setPax.bind(this)}>
                      { paxNr }
                    </li>
                  )
                }
              </ul>
            </div>
          </div>
          : <div></div>
        }

        <form onSubmit={() => this.submitBooking()} class="customer-details">
          <ul class="contact-details">
            <li class="phone-number">
              <div>
                <label htmlFor="phone-number">Teléfono</label>
                <input type="number" id="phone-number" value={this.bookingInfo.phone} onInput={(e) => this.handlePhoneChange(e)} pattern="/^[0-9]{9,9}$/" placeholder="654321123"/>
              </div>
            </li>
            <li class="email-address">
              <div>
                <label htmlFor="email-address">Email</label>
                <input type="email" id="email-address" value={this.bookingInfo.email} onInput={(e) => this.handleEmailChange(e)} placeholder="you@somewhere.something"/>
              </div>
            </li>
          </ul>
          <div class="special-requests">
              <label htmlFor="special-requests">Solicitud particular</label>
              <input type="text" id="special-requests" value={this.bookingInfo.notes} onInput={(e) => this.handleNotesChange(e)} placeholder="Especifique aqui ti tiene alguna solicitud particular."/>
          </div>
          <input type="submit" class="button-submit" value="Reservar"/>
        </form>
      </div>
    )
  }
}

export class BookingInfo {
  day: Date;
  time: string;
  pax: number;
  notes: string;
  phone: string;
  email: string;
  phoneChanged: boolean;
  service: string;
}

interface DayHours {
  day: Date;
  hours: Array<number>;
}

enum BookingStates {
  not_submitted = 'NOT_SUBMITTED',
  submitting = 'SUBMITTING',
  submitted_ok = 'SUBMITTED_OK',
  submitted_ko = 'SUBMITTED_KO',
}

const getCheftonicDate = (date: Date) => (date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate());
