import { Component, Prop, State, Element } from '@stencil/core';
import { ApolloClientProvider, MasterDataProvider } from '../../providers/providers';
import gql from 'graphql-tag';
import Moment from 'moment-timezone';
import momentRange from 'moment-range';
import { DateRange } from 'moment-range';

const moment = momentRange.extendMoment(Moment);

import { ExtBookRequestInput, RestaurantBookingInfoQuery, BookRequestMutation } from '../../__generated__';
import { Calendar, CalendarConfig } from './calendar';

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

const CreateBookRequest = gql`
mutation BookRequest ($booking_info: ExtBookRequestInput!) {
  createExtBookRequest (book_request: $booking_info) {
    book_date
    num_pax
    restaurant {
      r_name
    }
  }
}
`;

/**
 * Read the README file to know about component's functionality
 */
@Component({
  tag: 'cheftonic-booking-component',
  styleUrl: 'cheftonic-booking-component.scss',
  shadow: true
})
export class MakeBookingComponent {
  
  // The input object is an API Key identifier, bounded to the particular business.
  @Prop() apikey: string;

  // The input object is the restaurant_id where the user wants to make the booking
  restid: string;

  @Element() el: HTMLElement;

  // Internal object to represent the data of the booking
  bookingInfo: BookingInfo;
  bookingResult: BookRequestMutation;

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
  // Set the default booking interval
  bookingInterval = MinutesInterval.HALF; 
  showHourMinute: boolean;
  soonestBookingDate: Date;

  // States of the component
  @State() booking_state: BookingStates;
  phone_required: boolean;

  // Restaurant load status
  restaurant_status: RestaurantStates;

  // Providers
  _apolloProvider: ApolloClientProvider;
  _masterDataProvider: MasterDataProvider;

  // Selectors
  _daySelector: Calendar;

  constructor() {
    this._apolloProvider = new ApolloClientProvider();
    this._masterDataProvider = new MasterDataProvider(this._apolloProvider);

    // Initialize default booking setup
    this.bookingInfo = new BookingInfo();
    this.bookingInfo.pax = 2;
    this.bookingInfo.day = moment();

    this.showHourMinute = false;

    this.booking_state = BookingStates.not_submitted;
    this.restaurant_status = RestaurantStates.not_loaded;
  }

  private isValidKey (key:string):boolean {
    const restIdRegexp = '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}.[0-9]{1,3}$'
    // console.log ('Validating key ['+key+']: ' + new RegExp(restIdRegexp).test(key));
    return new RegExp(restIdRegexp).test(key);
  }

  private async initCalendarComponent() {
    console.log ('Initializing calendar...')
    this._daySelector = new Calendar(this._masterDataProvider,
      async (param:Array<Date>) => {
        this.bookingInfo.day = this._getOpeningHoursForDay(moment(param.pop())).services[0].range.start;
        await this.setHourMinuteConfigForDate ();
        this.toggleCalendarShow();
        console.log ('MAKE-BOOKING SELECT DAY - ' + this.bookingInfo.day);
      }
      , async (param:Date) => {
        console.log ('MAKE-BOOKING MONTH CHANGE - ' + param.toISOString());
        
        // Check if it's the current month, in which case we have to use the current date
        if (moment().isSame (param, 'month')) {
          this.bookingInfo.day = this.findFirstBookingTime();
        } else {
          this.bookingInfo.day = this.findFirstBookingTime(moment(param))
        }

        this.calendarConfig = this.getCalendarConfigFromDate();
        await this._daySelector.setConfig (this.calendarConfig);

        // Don't display the hourMinute component until some day is selected
        this.showHourMinute = false;
      });
      console.log ('Calendar created!');
      this.calendarConfig = this.getCalendarConfigFromDate ();
      console.log ('Calendar config: ' + JSON.stringify (this.calendarConfig,null,2));
      await this._daySelector.setConfig (this.calendarConfig);
  }

  async componentWillLoad() {
    // Validate input parameter
    if (this.isValidKey(this.apikey)) {
      this.restid = this.apikey;
      console.log ("Apollo client version: " + this._apolloProvider.getApolloClient().version);
      const restQuery = await this._apolloProvider.getApolloClient().query<RestaurantBookingInfoQuery> ({
        query: RestaurantBookingInfo,
        variables: {
          b_r_id: this.restid
        }
      })
      const restData = restQuery.data;
      // console.log ("Restaurant info retrieved: " + JSON.stringify(data, null, 2));
      if (restData.getRestaurantById.opening && restData.getRestaurantById.services && this.validateRestData(restData)) {
        // Fetch the data
        this.opening = restData.getRestaurantById.opening;
        this.services = restData.getRestaurantById.services;
        this.openHoursPerDay = new Map<string, DayHours>();

        this.bookingInfo.day = this.findFirstBookingTime();

        await this.initCalendarComponent();
        
        await this.setHourMinuteConfigForDate ();

        // The restaurant is loaded and ready to receive bookings
        this.restaurant_status = RestaurantStates.ok;
      } else {
        // There is no info about opening and/or services, mark it.
        this.restaurant_status = RestaurantStates.info_pending;
      }
    } else {
      // TODO: Invalid key, show an error
      this.booking_state = BookingStates.invalid_id;
    }
  }

  private findFirstBookingTime (candidateDate?:Moment.Moment):Moment.Moment {
    if (!candidateDate) {
      candidateDate = moment();
    }

    let availableHours:DayHours;

    do {
      availableHours = this._getOpeningHoursForDay(candidateDate)
      if (availableHours.services.length === 0) {
        // Evaluate next day
        candidateDate.add(1,'day').startOf('day');
      }
    } while (availableHours.services.length === 0);
    // Return the first date of the first service for that day
    return availableHours.services[0].range.start;
  }

  private validateRestData(restData) {
    // Check that at least there's one week day opened both in restaurant and services
    return ((restData.getRestaurantById.opening.open_weekdays.length > 0)
    // Check that there are services with valid hours, opened at least one weekday and with the flag online_allowed to true
    && (restData.getRestaurantById.services.filter (service => (
      // (service.starts_at > service.ends_at) && 
      (service.open_weekdays.length > 0) && 
      service.booking_config.online_allowed) ).length > 0)
    )
  }

  private getCalendarConfigFromDate (): CalendarConfig {
      return {
        weekdaysEnabled: this.opening.open_weekdays,
        disabledDays: this.getDisabledDaysInMonth(this.bookingInfo.day),
        multiSelection: false,
        todayTomorrow: false,
        dateFrom: this.bookingInfo.day.toDate()
      };
  }

  private getDisabledDaysInMonth (currDay: Moment.Moment):Date[] {
    const closing_days:Array<Date> = (this.opening.closing_days as Array<string>).map (dateStr => moment(dateStr, 'YYYY/MM/DD').toDate());

    if (closing_days.length == 0) {
      return []
    } else {
      const today = moment();
      // Return the days ahead of today and in the month being displayed.
      return closing_days.filter ((day) => ((today.diff (day, 'days')>=0) && (currDay.diff (day, 'months') == 0)));
    }
  }

  private async setHourMinuteConfigForDate () {
    this.booking_state = BookingStates.not_submitted;
    this.showHourMinute = true;
  }

  /**
   * Wrapper of getOpeningHoursForDay to share code between getOpeningHoursForDay and getDisabledDaysInMonth methods
   * Given a certain day, gives back the available hours for that day.
   * It should cache the already computed days in a map with the day as key.
   * @param day Day to be processed
   * @param dowMD Days of the week coming from the Master Data table
   */
  private _getOpeningHoursForDay (day: Moment.Moment): DayHours {
    // 1. Get the date in cheftonic format
    const cheftoDate: string = getCheftonicDate(day.toDate());
    // console.log ('getOpeningHoursForDay for ' + cheftoDate)

    // 1.1. Check if the day is already cached, and if so return the computed hours. First check if it's null
    if (this.openHoursPerDay.has(cheftoDate)) {
      // console.log ("getOpeningHoursForDay Returning: " + JSON.stringify (this.openHoursPerDay.get (cheftoDate), null, 2))
      return this.openHoursPerDay.get (cheftoDate);
    }

    // 2. Check if it's in the closing_days array, if so, return an empty array
    if (this.opening.closing_days && this.opening.closing_days.includes (cheftoDate)) {
      const dh:DayHours = {day: day, services: []};
      // console.log ("getOpeningHoursForDay Returning: " + JSON.stringify (dh, null, 2))
      this.openHoursPerDay.set (cheftoDate, dh);
      return dh;
    }

    /*
    3. Filter the services according to the following:
      a. Services that are allowed to be booked online
      b. Services active in that particular weekday. If open_weekdays is not present, it means that is available all days.
      c. If the selected day is the current day, check the start and end service time.
    */

    // Check if the restaurant is open that day of week
    // Map the services array to effective date ranges where the online booking is allowed in this particular day

    const serviceHoursAvailable = this.services.map ((svc):Array<ServiceRange> => {
      // console.log ("processing service: " + JSON.stringify (svc, null, 2));
      // (a.) Services that are allowed to be booked online
      
      if (svc.booking_config.online_allowed) {
        // (b.) Services active in that particular weekday. If open_weekdays is not present, it means that is available all days.
        const openedDoW = (svc.open_weekdays) ? (svc.open_weekdays.includes(day.format ('dddd').toLowerCase())) : true;
        if (openedDoW) {
          // First we do some common cases calculations to use them later
          const d = moment();
          const startTime = moment(day).hour(svc.starts_at.split(':')[0]).minute(svc.starts_at.split(':')[1]).startOf('minute');
          const endTime = moment(day).hour(svc.ends_at.split(':')[0]).minute(svc.ends_at.split(':')[1]).startOf('minute');
          
          const svcRange = moment.range (startTime, endTime);
          let serviceValidRange:ServiceRange = {id: svc.rs_id, range: svcRange};
          
          if (d.isSame(day, 'day')) {
            // console.log ("TODAY");
            // (c.) If the selected day is the current day, check the start and end service time.
            // If the service has the in_advance parameter set, we add these minutes to current time, 
            // as it's the soonest time this service can be booked in advance.
            let soonestBookingTimeFromNow = (svc.booking_config.in_advance) ? moment().add (svc.booking_config.in_advance, 'minutes') : moment();
            // Get the number of minutes to the next interval
            const minsToNextInterval = this.bookingInterval - (soonestBookingTimeFromNow.minute() % this.bookingInterval);
            soonestBookingTimeFromNow.add (minsToNextInterval, 'minutes').startOf('minute');

            if (soonestBookingTimeFromNow.isBefore(startTime)) {
              // The service hasn't started yet or it is starting, return all hours in the service
              return [serviceValidRange];
            } else if (soonestBookingTimeFromNow.isAfter (endTime)) {
              // The service has finished
              // console.log ("Returning empty: the service has finished");
              return [];
            } else {
              // The time is in between the service, get the hours remaining until it finishes
              serviceValidRange.range = moment.range (soonestBookingTimeFromNow, endTime)
              return [serviceValidRange]
            }
          } else {
            // It is not today, return all available hours for this service.
            return [serviceValidRange];
          }
        } else {
          // dayOfWeekFlag false
          // console.log ("Returning empty: dayOfWeekFlag false");
          return [];
        }
      } else {
        // bookOnlineFlag false
        // console.log ("Returning empty: bookOnlineFlag false");
        return [];
      }
    })
    .reduce ((prev, curr) => {
      const res = prev.concat(curr);
      return res;
    });

    const res:DayHours = {day: day, services: serviceHoursAvailable};
    // put it on the map to cache it
    this.openHoursPerDay.set (cheftoDate, res);

    // console.log ("FINAL RESULT: " + JSON.stringify(res,null,2));

    return res;
  }

  setPax(event) {
    this.bookingInfo.pax = event.target.value;
    this.togglePaxShow();
  }

  toggleCalendarShow() {
    this.showCalendar = !this.showCalendar;
    if (this.showCalendar) {
      this.showTime = this.showPax = false;
      this.el.shadowRoot.getElementById('cheftonic-booking-wrapper').style.height='370px';
    } else {
      this.el.shadowRoot.getElementById('cheftonic-booking-wrapper').style.height='';
    }
  }

  toggleTimeShow() {
    if (!(this.booking_state == BookingStates.invalid_day)) {
      this.showTime = !this.showTime;
    }
    if (this.showTime) {
      this.showCalendar = this.showPax = false;
      this.el.shadowRoot.getElementById('cheftonic-booking-wrapper').style.height='370px';
    } else {
      this.el.shadowRoot.getElementById('cheftonic-booking-wrapper').style.height='';
    }
  }

  togglePaxShow() {
    this.showPax = !this.showPax;
    if (this.showPax) {
      this.showCalendar = this.showTime = false;
      this.el.shadowRoot.getElementById('cheftonic-booking-wrapper').style.height='370px';
    } else {
      this.el.shadowRoot.getElementById('cheftonic-booking-wrapper').style.height='';
    }
  }

  async submitBooking() {
    // Select form and force HTML5 validation
    const f = this.el.shadowRoot.getElementById('booking-form') as HTMLFormElement

    if(! f.reportValidity()) {
      return false;
    }

    // Check if the phone has been filled correctly
    this.booking_state = BookingStates.submitting;
    // Build the BookingInput object
    const bookRequestInput:ExtBookRequestInput = {
      b_r_id : this.restid,
      book_date: this.bookingInfo.day.toISOString(),
      made_on: new Date().toISOString(),
      num_pax: this.bookingInfo.pax,
      notes: this.bookingInfo.notes,
      phone: this.bookingInfo.phone,
      email: this.bookingInfo.email,
      name: this.bookingInfo.name,
      surname: this.bookingInfo.surname,
      channel: 'external_web',
      service: this._getOpeningHoursForDay(this.bookingInfo.day).services.find (service => this.bookingInfo.day.within(service.range)).id
    };

    console.log ('Submitting booking info: ' + JSON.stringify(bookRequestInput,null,2));

    try {
      const mutationResult = await this._apolloProvider.getApolloClient().mutate<ExtBookRequestInput> ({
        mutation: CreateBookRequest,
        variables: {
          booking_info: bookRequestInput
        }
      })

      this.bookingResult = mutationResult.data;
      this.booking_state = BookingStates.submitted_ok;
      console.log ('Booking submitted successfully');

    } catch (error) {
      this.booking_state = BookingStates.submitted_ko;
      console.log ('Booking submitted with errors: ' + error);
    }

  }

  handleNameChange(event) {
    this.bookingInfo.name = event.target.value;
    if (event.target.validity.typeMismatch) {
      console.log('this element is not valid')
    }
  }

  handleSurnameChange(event) {
    this.bookingInfo.surname = event.target.value;
    if (event.target.validity.typeMismatch) {
      console.log('this element is not valid')
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

  setTime (event) {
    console.log ('Time Selected: ' + event.target.textContent);
    this.bookingInfo.day.hour(event.target.textContent.split(':')[0]).minute(event.target.textContent.split(':')[1]).startOf('minute')
    this.toggleTimeShow();
    console.log ('MAKE-BOOKING FULL TIME - ' + this.bookingInfo.day.toISOString() + '. Localized: ' + moment(this.bookingInfo.day).toLocaleString());
  }

  _getHoursToDisplayForDay (day:Moment.Moment) {
    const dayHours = this._getOpeningHoursForDay(day);
    const hoursList = dayHours.services.map (serviceSlot => {
      const serviceSlotList = Array.from(serviceSlot.range.by ('minutes', {excludeEnd: true, step: MinutesInterval.HALF}))
      return serviceSlotList
    }).reduce ((prev, curr) => {
      const res = prev.concat(curr);
      return res;
    });
    return hoursList
  }

  render () {
    if (this.booking_state == BookingStates.invalid_id) {
      return (
        <div id="cheftonic-booking-wrapper" class="cheftonic-booking-wrapper">
          <div class="error-noapi">
            <p>Parece haber un error de configuración en su componente.</p>
            <p>Para solucionarlo por favor envíe un correo a <a href={'"mailto:support@cheftonic.com?&amp;subject=Booking%20component%20issue&amp;body=apikey%20:%20"'+this.apikey+'"'}>support@cheftonic.com</a> incluyendo sus datos y esta información:</p>
            <p><code>apikey = {this.apikey}</code></p>
            <div class="logo">
              { getCheftonicLogo() }
            </div>
          </div>
        </div>
      )
    }
    if (this.booking_state == BookingStates.submitted_ok) {
      return (
        <div class="confirm animate-bottom">
          <div class="header">
            <svg viewBox="0 0 30 30"  xmlns="http://www.w3.org/2000/svg"><g fill="#FFFFFF" fill-rule="evenodd"><path d="m7.8579 16.4645c-.391-.391-.391-1.024 0-1.414.391-.391 1.024-.391 1.414 0l3.536 3.535 8.485-8.485c.391-.39 1.024-.39 1.414 0 .391.391.391 1.024 0 1.414l-9.192 9.193c-.391.39-1.024.39-1.414 0z"/><path d="m15 29c-7.732 0-14-6.268-14-14s6.268-14 14-14 14 6.268 14 14-6.268 14-14 14m0-29c-8.284 0-15 6.716-15 15s6.716 15 15 15 15-6.716 15-15-6.716-15-15-15"/></g></svg>
              <p>Se ha enviado su solicitud de reserva para <span class="people">{ this.bookingResult.createExtBookRequest.num_pax }</span> en <span class="restaurant">{ this.bookingResult.createExtBookRequest.restaurant.r_name }</span><span class="reservation"> el <span class="date">{ new Date(this.bookingResult.createExtBookRequest.book_date).toLocaleDateString('es', { year:"numeric", month:"long", day:"numeric" }) }</span> a las <span class="time">{ new Date(this.bookingResult.createExtBookRequest.book_date).toLocaleTimeString('es', { hour:"2-digit", minute:"2-digit", hour12: false }) }</span></span></p>
          </div>
          <div class="notice">
            <p>Recibirá un email con el acuse de recibo y ahora el restaurante deberá aceptar su reserva, tras lo cual recibirá otro email de confirmación.</p>
            <p>Muchas gracias por confiar en nosotros.</p>
          </div>
          <input type="button" class="button-reset" value="Realizar otra reserva" onClick={()=>this.booking_state = BookingStates.not_submitted}/>
          <div class="logo">
            { getCheftonicLogo() }
          </div>
        </div>
      )
    }
    if (this.booking_state == BookingStates.submitting) {
      return (
        <div class="loader">
          <div class="notice">Enviando su solicitud...</div>
          <div id="loader" class="animation"></div>
        </div>
      )
    }
    // Main screen
    return (
      <div id="cheftonic-booking-wrapper" class="cheftonic-booking-wrapper">
        <div class="cheftonic-booking-container">
          <div class="submit-booking-col" onClick = {this.togglePaxShow.bind(this)}>
            <span>{ this.bookingInfo.pax.toString().concat ((this.bookingInfo.pax > 1)?' personas':' persona')  }</span>
            <span class="icon">
              <svg height="7" viewBox="0 0 100 56" width="13" xmlns="http://www.w3.org/2000/svg"><path d="m45.6195417 76.1916897-43.80544294-43.6532449c-2.41879835-2.4103944-2.41879835-6.3195686 0-8.730649 2.41948667-2.4103944 6.34229025-2.4103944 8.76108864 0l39.4248986 39.2879204 39.4248987-39.2879204c2.4187984-2.4103944 6.3416019-2.4103944 8.7604003 0 2.419487 2.4110804 2.419487 6.3202546 0 8.730649l-43.8047547 43.6532449c-2.4194866 2.4110804-6.3416019 2.4110804-8.7610886 0" fill-rule="evenodd" transform="translate(0 -22)"/></svg>
            </span>
          </div>
          <div class="submit-booking-col" onClick = {this.toggleCalendarShow.bind(this)}>
              <label class="booking-bar-date">{ this.bookingInfo.day.toDate().toLocaleDateString(navigator.language, { year: 'numeric', month: 'short', day: 'numeric' }) }</label>
              <span class="icon">
                <svg height="7" viewBox="0 0 100 56" width="13" xmlns="http://www.w3.org/2000/svg"><path d="m45.6195417 76.1916897-43.80544294-43.6532449c-2.41879835-2.4103944-2.41879835-6.3195686 0-8.730649 2.41948667-2.4103944 6.34229025-2.4103944 8.76108864 0l39.4248986 39.2879204 39.4248987-39.2879204c2.4187984-2.4103944 6.3416019-2.4103944 8.7604003 0 2.419487 2.4110804 2.419487 6.3202546 0 8.730649l-43.8047547 43.6532449c-2.4194866 2.4110804-6.3416019 2.4110804-8.7610886 0" fill-rule="evenodd" transform="translate(0 -22)"/></svg>
              </span>
          </div>
          <div class="submit-booking-col" onClick = {this.toggleTimeShow.bind(this)}>
            <label class="booking-bar-Time">{ this.bookingInfo.day.format ('HH:mm') }</label>
            <span class="icon">
              <svg height="7" viewBox="0 0 100 56" width="13" xmlns="http://www.w3.org/2000/svg"><path d="m45.6195417 76.1916897-43.80544294-43.6532449c-2.41879835-2.4103944-2.41879835-6.3195686 0-8.730649 2.41948667-2.4103944 6.34229025-2.4103944 8.76108864 0l39.4248986 39.2879204 39.4248987-39.2879204c2.4187984-2.4103944 6.3416019-2.4103944 8.7604003 0 2.419487 2.4110804 2.419487 6.3202546 0 8.730649l-43.8047547 43.6532449c-2.4194866 2.4110804-6.3416019 2.4110804-8.7610886 0" fill-rule="evenodd" transform="translate(0 -22)"/></svg>
            </span>
          </div>
        </div>


        {(this.showPax) &&
          <div id="booking-pax-container" class="people-container">
            <div class="people_box popup">
              <ul class="pax-list">
                {[1,2,3,4,5,6,7,8,9,10].map(paxNr =>
                    <li class="item" value={paxNr} onClick = {this.setPax.bind(this)}>
                      { paxNr.toString().concat ((paxNr > 1)?' personas':' persona') }
                    </li>
                  )
                }
              </ul>
            </div>
          </div>
        }

        {(this.showCalendar) &&
          <div id="booking-cal-container" class="calendar-container">
            { this._daySelector.renderCalendar() }
          </div>
        }

        {(this.showTime) &&
          <div id="booking-time-container" class="time-container">
            <div class="time_box popup">
              <ul class="time-list">
                { this._getHoursToDisplayForDay(this.bookingInfo.day).map (bookingTime =>
                    <li value= {bookingTime.toISOString()} onClick={this.setTime.bind(this)} class="booking_time">
                    { bookingTime.format ('HH:mm') }
                  </li>
                  )
                }
              </ul>
            </div>
          </div>
        }

        <form id ="booking-form" class="cheftonic-details-container">
          <div class="name">
            <span class="form-control">
              <label htmlFor="name">Nombre:</label>
              <input type="text" id="name" required value={this.bookingInfo.name} onInput={(e) => this.handleNameChange(e)} pattern="[A-zÀ-ú ]{3,20}$" placeholder="Alfonso" title="El nombre únicamente puede contener entre 3 y 20 caracteres mayúsculas, minúsculas, caracteres acentuados y espacios. p.e. Alfonso Víctor"/>
            </span>
          </div>
          <div class="surname">
            <span class="form-control">
              <label htmlFor="surname">Apellido:</label>
              <input type="text" id="surname" required value={this.bookingInfo.surname} onInput={(e) => this.handleSurnameChange(e)}  pattern="[A-zÀ-ú  -]{3,20}" placeholder="García" title="El apellido únicamente puede contener entre 3 y 20 caracteres mayúsculas, minúsculas, caracteres acentuados, espacios y guión medio. p.e. Sánchez-García"/>
            </span>
          </div>
          <div class="phone-number">
            <span class="form-control">
              <label htmlFor="phone-number">Teléfono:</label>
              <input type="number" id="phone-number" required value={this.bookingInfo.phone} onInput={(e) => this.handlePhoneChange(e)} pattern="^\d{9,9}$" placeholder="654321123" title="El teléfono únicamente puede contener 9 números, pre. p.e. 654321123"/>
            </span>
          </div>
          <div class="email-address">
            <span class="form-control">
              <label htmlFor="email-address">Email:</label>
              <input type="email" id="email-address" required value={this.bookingInfo.email} onInput={(e) => this.handleEmailChange(e)} placeholder="you@somewhere.something"/>
            </span>
          </div>
          <div class="special-requests">
              <label htmlFor="special-requests">Solicitud particular:</label>
              <textarea id="special-requests" value={this.bookingInfo.notes} onInput={(e) => this.handleNotesChange(e)} placeholder="Especifique aqui si tiene alguna solicitud particular."/>
          </div>
          {(this.booking_state == BookingStates.submitted_ko) && <span class="error-message">Se ha producido un error al enviar su reserva, por favor inténtelo mas tarde.</span>}

          {(this.booking_state == BookingStates.invalid_day) ?
           <span class="error-message">No hay horas disponibles para este día, por favor seleccione otra fecha.</span>
          : <input type="button" class="button-submit" value="Reservar" onClick={this.submitBooking.bind(this)}/>}

          <div class="logo">
            { getCheftonicLogo() }
          </div>
        </form>
      </div>
    )
  }
}

export class BookingInfo {
  day: Moment.Moment;
  pax: number;
  notes: string;
  phone: string;
  email: string;
  name: string;
  surname: string;
  service: string;
}

interface ServiceRange {
  id: string;
  range: DateRange
}
interface DayHours {
  day: Moment.Moment;
  services: Array<ServiceRange>;
}

enum BookingStates {
  not_submitted = 'NOT_SUBMITTED',
  submitting = 'SUBMITTING',
  submitted_ok = 'SUBMITTED_OK',
  submitted_ko = 'SUBMITTED_KO',
  invalid_day = 'INVALID_DAY',
  invalid_id = 'INVALID_ID',
}

enum RestaurantStates {
  ok = 'OK',
  info_pending = 'LOAD_PENDING',
  not_loaded = 'NOT_LOADED'
}

enum MinutesInterval {
  QUARTERLY = 15,
  HALF = 30,
  FULL = 60
}

const getCheftonicDate = (date: Date) => (date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate());

const getCheftonicLogo = () => {
  return (
    <svg viewBox="0 0 502 161" xmlns="http://www.w3.org/2000/svg"><path d="m334.314 269.9772c-.614 3.152-1.428 5.84-2.444 8.061-1.015 2.222-2.201 4.062-3.555 5.523-1.355 1.459-2.751 2.189-4.189 2.189-1.65 0-3.069-.349-4.253-1.046-1.185-.7-2.137-1.629-2.856-2.793-.721-1.164-1.249-2.529-1.587-4.095-.34-1.566-.508-3.237-.508-5.015 0-3.511.338-6.665 1.016-9.458.676-2.793 1.607-5.342 2.793-7.649 1.184-2.306 2.56-4.199 4.125-5.681 1.565-1.48 3.216-2.222 4.952-2.222 1.311 0 2.433.361 3.364 1.08.93.719 1.692 1.693 2.285 2.919.592 1.228 1.037 2.677 1.333 4.349.295 1.672.444 3.481.444 5.427 0 2.455-.307 5.259-.92 8.411m-71.064-22.376c-.163 2.232-.261 4.359-.297 6.387-.903.614-1.843 1.203-2.849 1.747-2.201 1.225-4.91 2.335-8.125 3.327-3.217.992-6.919 1.488-11.108 1.488-.455 0-.84-.046-1.157-.138-.317-.093-.624-.195-.919-.306s-.623-.212-.986-.306c-.363-.092-.839-.138-1.429-.138-.49 0-.959.055-1.404.167-.446.11-1.115.351-2.006.721l.127-1.013c2.699-3.337 5.344-6.917 7.936-10.74 2.591-3.822 5.062-7.708 7.414-11.658.164-.275.32-.551.483-.827.473.209 1.039.365 1.718.458 2.3.284 4.058.519 5.271.707 1.214.189 2.215.366 3.004.53.787.165 1.533.33 2.236.495.702.164 1.693.341 2.972.53-.378 2.835-.672 5.692-.881 8.569m-29.611 60.148c-.149 2.39-.447 4.591-.893 6.602-.448 2.009-1.107 3.67-1.98 4.982s-2.034 1.968-3.48 1.968c-.47 0-.928-.285-1.374-.856-.448-.572-.852-1.81-1.214-3.714s-.66-4.697-.894-8.379-.351-8.633-.351-14.854c0-.888.042-2.104.127-3.649s.196-3.181.338-4.906c.139-1.726.317-3.939.533-6.64.215-2.701.381-4.783.498-6.245s.282-2.676.497-3.643c.214-.966.407-1.451.578-1.451.514 0 1.07.578 1.67 1.733.599 1.155 1.382 2.526 2.346 4.114.964 1.589 1.714 3.961 2.249 7.116.536 3.156.889 5.986 1.061 8.487.17 2.5.299 4.831.384 6.989.086 2.158.129 3.977.129 5.459 0 2.2-.075 4.496-.224 6.887m-2.566-69.279c.312-2.724.834-5.882 1.57-9.472.733-3.591 1.835-7.709 3.304-12.354 1.602-5.069 3.649-10.413 6.141-16.03 1.514-3.421 2.582-5.554 3.205-6.4.801-1.013 2.358-1.52 4.673-1.52 1.466 0 2.512.517 3.14 1.552.628 1.036.943 2.672.943 4.911 0 1.604-.771 4.287-2.312 8.046s-3.398 7.656-5.569 11.69-4.703 8.352-7.597 12.956-5.697 9.335-8.412 14.191c.298-2.322.603-4.845.914-7.57m-47.812 12.446c.918-1.013 1.953-1.913 3.249-2.575 1.295-.663 2.876-1.259 4.683-.994.683.1 1.88.6 2.581 1.8.7 1.2 1.051 2.731 1.051 4.594 0 1.324-.743 3-2.23 5.027s-3.183 3.829-4.733 5.029c-1.552 1.2-8.659 5.878-9.858 6.272 0-.911-1.773-11.393 5.257-19.153m-63.531-6.748c-1.201 2.873-1.939 4.601-3.752 6.831.731-13.085 2.731-29.085 7.636-41.747 2.92-6.851 5.46-12.075 7.619-15.672 2.158-3.595 3.788-5.393 4.889-5.393.902 0 1.354 1.609 1.354 4.824 0 2.116-.563 5.395-1.686 9.838-1.124 4.443-2.936 9.901-5.437 16.375-.764 1.904-1.729 4.221-2.896 6.951-1.166 2.729-2.406 5.627-3.72 8.695s-2.69 6.15-4.007 9.298m160.706-25.532c.913-3.613 1.89-6.922 2.931-9.926 1.042-3.004 2.125-5.472 3.25-7.404 1.126-1.933 2.242-2.899 3.347-2.899.806 0 1.433.168 1.879.506.447.337.776.758.988 1.264s.35 1.043.414 1.612c.063.569.096 1.085.096 1.548 0 1.338-.362 3.052-1.084 5.142-.722 2.091-1.636 4.339-2.74 6.743-1.105 2.404-2.347 4.85-3.728 7.338-1.38 2.487-2.708 4.797-3.983 6.929-.68-.062-1.339-.116-1.976-.164s-1.274-.102-1.911-.166c.765-3.402 1.604-6.91 2.517-10.523m225.825 48.34c1.428 2.32-.211 6.777-.211 6.777-3.174 4.529-6.601 8.57-10.283 12.124-1.565 1.524-3.268 3.005-5.109 4.444s-3.768 2.719-5.777 3.84c-2.01 1.122-4.105 2.031-6.284 2.73-2.18.697-4.387 1.047-6.622 1.047-3.919 0-7.358-.719-10.319-2.158s-5.443-3.365-7.444-5.777c-.853-1.028-1.599-2.14-2.275-3.307-.909.711-1.895 1.442-2.971 2.197-2.263 1.586-4.708 3.047-7.331 4.379-2.624 1.334-5.3 2.444-8.03 3.333-2.728.889-5.321 1.333-7.775 1.333-2.202 0-4.053-.307-5.555-.92s-2.719-1.471-3.649-2.571c-.824-.972-1.427-2.146-1.836-3.497-3.453 1.825-5.718 2.975-6.765 3.433-3.301 1.482-5.354 2.328-6.156 2.539-2.117.678-4.338 1.016-6.666 1.016s-4.285-1.682-5.871-5.047c-1.588-3.363-2.381-8.283-2.381-14.758 0-2.539.17-5.278.508-8.22.337-2.941.761-6.104 1.269-9.49h-1.016l-16.63 33.008c-.889 1.777-1.841 2.963-2.856 3.555-1.058.635-2.286.952-3.682.952-1.736 0-3.132-.37-4.189-1.111-1.059-.74-1.873-1.735-2.444-2.983-.572-1.248-.952-2.666-1.143-4.254-.19-1.586-.286-3.225-.286-4.919 0-2.793.169-6.019.508-9.68.277-2.998.615-6.253 1.006-9.735-1.886-7.24-5.403-10.394-8.289-13.179-1.249-1.206-3.935-2.762-5.459-3.778l-.508.699c1.227 2.455 2.148 5.045 2.762 7.776.612 2.728.92 5.807.92 9.235 0 2.497-.276 5.015-.825 7.554-.551 2.539-1.344 4.994-2.381 7.363-1.037 2.37-2.307 4.592-3.808 6.665-1.503 2.074-3.217 3.872-5.142 5.396-1.926 1.523-4.031 2.729-6.316 3.618s-4.719 1.333-7.3 1.333c-3.724 0-6.909-.815-9.553-2.443-2.645-1.629-4.814-3.756-6.506-6.38-.544-.843-1.024-1.735-1.474-2.648-4.377 5.51-8.407 7.242-9.819 7.916-2.48 1.186-4.682 2.074-6.61 2.666-1.929.593-3.677.889-5.244.889-3.2 0-6.02-.973-8.461-2.92-2.441-1.946-4.482-4.75-6.124-8.41s-2.872-8.094-3.692-13.299c-.3-1.897-.543-3.884-.733-5.955-2.179 1.052-4.431 1.909-6.758 2.562-3.047.855-5.862 1.497-8.442 1.924-3.005.47-6.026.77-9.065.898 1.633 2.788 3.107 5.68 4.423 8.678 1.134 2.577 2.165 5.46 3.096 8.648.929 3.188 1.394 6.409 1.394 9.661 0 .379-.058 1.182-.17 2.407-.114 1.224-.303 2.724-.569 4.498-.266 1.773-.643 3.737-1.13 5.892-.487 2.153-1.118 4.328-1.894 6.525-.776 2.195-1.717 4.318-2.825 6.366-1.107 2.047-2.404 3.864-3.888 5.449-1.483 1.583-3.189 2.86-5.116 3.832-1.928.97-4.111 1.457-6.547 1.457-2.312 0-4.33-.528-6.053-1.582-1.724-1.057-3.195-2.48-4.414-4.273-1.22-1.793-2.24-3.882-3.059-6.265-.819-2.386-1.461-4.906-1.923-7.564s-.788-5.37-.977-8.132c-.188-2.764-.283-5.433-.283-8.006 0-.212.053-1.499.159-3.861.08-1.791.232-4.034.454-6.724-.792.683-1.514 1.258-2.069 1.592-2.094 1.264-4.295 2.387-6.601 3.367-2.307.979-4.697 1.764-7.173 2.352-2.476.589-4.985.883-7.526.883-3.952 0-7.409-.732-10.372-2.197-2.964-1.464-5.434-3.435-7.409-5.911-.313-.392-.592-.811-.88-1.222-.675.463-1.381.939-2.126 1.431-1.419.933-2.952 1.877-4.602 2.832-1.65.954-3.312 1.797-4.983 2.533-1.672.736-3.343 1.342-5.015 1.819s-3.269.715-4.792.715c-2.382 0-4.45-.594-6.204-1.784s-3.194-2.702-4.32-4.537c-1.126-1.834-1.97-3.84-2.533-6.018-.564-2.179-.845-4.234-.845-6.171 0-1.367.187-2.895.562-4.584.374-1.687.836-3.388 1.386-5.097.551-1.71 1.168-3.376 1.85-5.001.682-1.624 1.321-3.078 1.916-4.361.595-1.282 1.112-2.329 1.553-3.141.44-.813 1.013-1.799.571-2.066-.575-.346-2.982 2.094-4.695 3.978-1.714 1.883-3.65 4.259-5.809 7.126-2.158 2.867-4.39 6.09-6.696 9.669-2.307 3.578-4.391 7.271-6.253 11.08-.931 1.884-1.693 3.527-2.285 4.929-.593 1.403-1.174 2.531-1.745 3.385-.572.856-1.197 1.501-1.873 1.938-.677.437-1.545.655-2.603.655-1.396 0-2.497-.377-3.3-1.133-.805-.755-1.419-1.759-1.841-3.01-.424-1.252-.698-2.672-.825-4.262s-.191-3.22-.191-4.89c0-.413.001-.85.002-1.3-1.011.848-2.027 1.731-3.049 2.655-1.989 1.796-4.052 3.693-6.189 5.686-2.137 1.995-4.443 3.851-6.919 5.566-2.475 1.716-5.173 3.356-8.093 4.919-2.92 1.562-6.147 2.932-9.68 4.109-3.534 1.176-7.427 2.112-11.68 2.806-4.253.695-8.961 1.041-14.123 1.041-5.713 0-10.866-1.137-15.457-3.413-4.592-2.275-8.516-5.343-11.775-9.205s-5.766-8.349-7.522-13.464c-1.756-5.113-2.634-10.488-2.634-16.125 0-3.92.422-8.128 1.27-12.623.846-4.495 2.063-9.076 3.649-13.742 1.587-4.666 3.523-9.321 5.809-13.966 2.285-4.644 4.877-9.097 7.775-13.358s6.083-8.213 9.554-11.857c3.469-3.643 7.173-6.818 11.108-9.523 3.936-2.706 8.083-4.826 12.441-6.36 4.358-1.533 8.887-2.301 13.584-2.301 3.047 0 6.136.539 9.268 1.619 3.131 1.079 5.945 2.74 8.442 4.982 2.497 2.244 4.539 5.079 6.126 8.506 1.587 3.428 2.38 7.47 2.38 12.124 0 3.133-.498 6.295-1.491 9.49-.995 3.196-2.36 6.263-4.095 9.204-1.735 2.942-3.777 5.703-6.125 8.284-2.349 2.581-4.878 4.814-7.586 6.696-2.708 1.884-5.522 3.376-8.442 4.476s-5.84 1.65-8.76 1.65c-3.851 0-6.728-.517-8.633-1.554-1.904-1.038-2.856-2.529-2.856-4.476 0-.338-.011-.74-.032-1.206-.022-.465-.031-.952-.031-1.46 0-.762.041-1.555.126-2.38.085-.826.254-1.577.508-2.254.254-.676.624-1.227 1.111-1.65.486-.423 1.152-.635 2-.635.507 0 .952.074 1.333.222.381.149.803.308 1.269.476.466.17 1.026.328 1.682.476.656.149 1.492.222 2.508.222 2.707 0 5.448-.592 8.22-1.777 2.771-1.184 5.268-2.856 7.49-5.015 2.222-2.158 4.041-4.729 5.459-7.712s2.127-6.273 2.127-9.871c0-1.904-.254-3.713-.762-5.427s-1.333-3.215-2.476-4.507c-1.142-1.29-2.613-2.326-4.411-3.11-1.8-.783-3.99-1.174-6.57-1.174-3.047 0-6.021.672-8.919 2.017-2.899 1.345-5.681 3.169-8.347 5.474s-5.195 5.037-7.585 8.194c-2.391 3.159-4.602 6.541-6.634 10.148-2.031 3.606-3.862 7.362-5.49 11.268-1.63 3.906-3.015 7.8-4.158 11.684s-2.022 7.65-2.634 11.3c-.614 3.649-.921 7.01-.921 10.083 0 4.515.54 8.45 1.619 11.801 1.079 3.353 2.612 6.147 4.602 8.382 1.989 2.237 4.421 3.903 7.3 4.997 2.877 1.096 6.115 1.644 9.712 1.644 4.485 0 8.664-.58 12.536-1.741 3.872-1.162 7.564-2.686 11.077-4.57 3.512-1.884 6.908-4.011 10.188-6.378 3.279-2.366 6.559-4.745 9.839-7.132 3.279-2.389 7.277-6.2 10.453-8.696.575-.452 1.188-.965 1.824-1.51.098-2.484.226-5.075.386-7.789.339-5.723.956-11.654 1.854-17.791.897-6.136 1.789-12.242 2.678-18.315.889-6.074 2.212-11.856 3.97-17.345 1.759-5.488 3.899-10.32 6.42-14.495 2.522-4.175 5.476-7.491 8.867-9.95 3.389-2.458 7.287-3.688 11.695-3.688 2.285 0 4.158.342 5.617 1.022 1.46.682 2.624 1.64 3.492 2.873.866 1.235 1.469 2.714 1.809 4.438.338 1.724.508 3.65.508 5.778 0 3.164-.445 6.669-1.333 10.516-.889 3.848-2.063 7.845-3.523 11.991-1.46 4.145-3.121 8.346-4.983 12.599-1.863 4.253-3.767 8.378-5.713 12.375-1.947 3.997-3.862 7.77-5.745 11.318-1.883 3.547-3.545 6.668-4.983 9.36 0 0 3.801-3.812 6.137-6.355 2.932-3.193 6.019-6.116 9.637-9.636 3.618-3.521 6.58-6.053 8.887-7.596 2.306-1.544 4.475-2.315 6.506-2.315.508 0 1.079.097 1.714.291s1.238.549 1.809 1.068c.572.517 1.048 1.239 1.428 2.167.381.927.572 2.123.572 3.589 0 2.933-.403 5.791-1.206 8.571-.804 2.782-2.328 6.157-4.571 10.125-2.243 3.967-3.755 7.396-4.538 10.285-.784 2.889-1.175 5.909-1.175 9.056 0 1.726.254 3.104.762 4.141.508 1.035 1.164 1.551 1.968 1.551 1.016 0 2.095-.213 3.237-.64 1.143-.428 7.013-3.202 8.156-3.886.15-.09.409-.221.748-.383-.49-2.357-.748-4.79-.748-7.307 0-2.338.249-7.378 1.134-10.615.884-3.238 2.405-10.421 9.82-18.357 1.763-1.888 5.766-4.304 8.144-5.328 2.379-1.024 5.02-1.535 7.924-1.535 2.372 0 4.575.38 6.608 1.141 2.034.761 3.803 1.828 5.307 3.202 1.503 1.373 2.679 3.033 3.526 4.977.848 1.943 1.272 4.121 1.272 6.529 0 2.566-.859 5.442-2.577 8.628s-3.732 5.906-6.011 8.192c-5.039 5.055-17.184 12.291-16.568 13.036.615.745 1.242 1.324 1.88 1.737.637.414 1.306.703 2.006.869.701.166 1.455.248 2.263.248 2.539 0 5.215-.496 8.029-1.489s5.938-2.306 8.467-4.017c2.734-1.85 5.26-4.235 7.513-6.845.446-4.538 1.025-9.275 1.758-14.236.843-5.709 1.837-11.564 2.983-17.568 1.144-6.003 2.506-11.849 4.083-17.537 1.577-5.687 3.382-11.049 5.413-16.084 2.031-5.034 4.311-9.437 6.839-13.208s5.348-6.751 8.46-8.942c3.111-2.191 6.525-3.287 10.243-3.287 1.435 0 2.945.248 4.528.742 1.583.495 3.029 1.298 4.338 2.411 1.31 1.113 2.397 2.587 3.263 4.421.864 1.834 1.298 4.09 1.298 6.768 0 2.492-.404 5.354-1.209 8.585s-1.938 6.685-3.397 10.36-3.179 7.497-5.161 11.467c-.59 1.182-1.201 2.363-1.824 3.543.687-.045 1.399-.076 2.146-.086 1.553-.021 3.042-.01 4.467.031 1.424.043 2.701.075 3.829.096 1.126.022 1.903-.01 2.328-.095 1.141-5.696 2.587-11.214 4.34-16.552 1.754-5.338 3.718-10.085 5.894-14.241 2.175-4.156 4.551-7.49 7.128-10.001s5.281-3.767 8.111-3.767c1.821 0 3.482.508 4.986 1.522 1.504 1.015 2.784 2.368 3.843 4.059 1.058 1.691 1.874 3.667 2.445 5.929s.858 4.619.858 7.071c0 2.029-.296 4.171-.89 6.427-.593 2.256-1.397 4.554-2.413 6.893-1.015 2.339-2.212 4.709-3.587 7.109-1.376 2.402-2.177 4.667-3.7 7.026 9.003-1.284 14.3-2.767 20.561-4.757.808-.257 1.549.011 2.203.731.653.72 1.204 1.725 1.652 3.015.519 1.494.541 2.85.067 4.066-.474 1.217-1.192 1.991-2.153 2.325 0 0-9.802 4.563-26.824 5.459-.915.048-1.531 0-1.531 0-.969 1.849-3.687 6.792-4.638 8.028-1.253 1.63-3.52 5.26-4.582 6.572-.169 2.624 0 0-.127 2.539-.042 1.1-.085 2.232-.127 3.396s-.085 2.317-.127 3.459c-.042 1.143-.074 2.243-.095 3.301-.022 1.058-.032 2.031-.032 2.92 0 2.285.213 4.211.637 5.776.424 1.567 1.042 2.847 1.849 3.841s1.794 1.713 2.963 2.158c1.168.444 2.474.666 3.919.666.889 0 2-.211 3.335-.635 1.03-.326 6.242-1.396 10.864-12.277-.003-.203-.018-.405-.018-.608 0-5.586.698-10.4 2.095-14.441 1.396-4.041 3.396-7.554 5.998-10.538 2.603-2.983 5.787-5.331 9.554-7.045 3.766-1.714 7.998-2.571 12.695-2.571 4.02 0 7.786.625 11.299 1.873 3.512 1.248 6.802 2.919 9.87 5.014 2.855 1.949 5.519 4.386 8.007 7.269.547-2.935 1.078-5.511 1.593-7.681.466-1.946 1.365-3.576 2.698-4.888 1.333-1.311 3.142-1.968 5.427-1.968 2.286 0 3.873.698 4.761 2.095.889 1.396 1.333 3.259 1.333 5.586 0 .635-.063 1.491-.19 2.57s-.286 2.265-.476 3.556c-.191 1.291-.392 2.624-.603 3.998-.213 1.376-.413 2.942-.603 4.697-.191 1.757-.349 3.069-.476 3.936-.127.868-.191 1.45-.191 1.746h1.27c.254-.465.655-1.216 1.206-2.254.549-1.036 1.184-2.528 1.904-4.475.719-1.946 1.492-3.671 2.317-5.174.825-1.501 1.597-2.94 2.316-4.316.719-1.374 1.375-2.591 1.969-3.649.592-1.058 1.035-1.841 1.332-2.349 1.354-2.285 2.899-3.85 4.635-4.697 1.734-.847 3.66-1.27 5.775-1.27 2.116 0 3.799.889 5.047 2.666s1.873 4.232 1.873 7.363c0 .466-.095 1.249-.287 2.349-.189 1.101-.433 2.412-.728 3.936-.297 1.523-.625 3.491-.985 5.903-.359 2.412-.687 4.57-.984 6.475-.297 1.904-.539 3.788-.731 5.649-.189 1.862-.285 3.576-.285 5.142 0 2.624.328 4.782.985 6.474.656 1.693 1.681 2.539 3.078 2.539.508 0 1.226-.19 2.158-.571 1.396-.508 2.285-.952 2.666-1.333 1.861-1.439 2.836-2.137 2.92-2.095.118.04 1.366-.699 3.714-2.195.081-.553.156-1.1.253-1.677 1.219-7.352 2.004-11.482 2.352-12.391.576-1.807 1.73-5.811 3.461-12.011 1.606-5.055 2.597-8.345 2.975-9.87.208-1.07.79-2.033 1.747-2.889.873-.769 1.859-1.401 2.962-1.893 1.101-.492 2.245-.855 3.43-1.091 1.184-.235 2.255-.353 3.211-.353 1.746 0 2.931.328 3.555.984.623.657.936 1.534.936 2.634 0 .931-.217 2.247-.652 3.947-.434 1.7-.93 3.637-1.486 5.812-.556 2.174-1.379 4.97-2.47 8.388s-1.836 6.332-2.235 8.743c-.4 2.412-.904 4.806-1.513 7.186-.608 2.38-.912 4.542-.912 6.489 0 1.903.211 3.416.635 4.537.423 1.12 1.29 1.68 2.602 1.68 1.524 0 3.216-.528 5.078-1.586s3.746-2.338 5.65-3.841c1.457-1.149 2.881-2.339 4.288-3.55-.256-1.652-.384-3.336-.384-5.051 0-2.454.425-5.395 1.276-8.823s1.776-6.421 2.776-8.983c1-2.559 2.232-5.002 3.7-7.331 1.468-2.326 3.169-4.369 5.106-6.125 1.935-1.755 4.094-3.152 6.477-4.19 2.382-1.036 4.997-1.555 7.848-1.555 2.566 0 4.941.371 7.125 1.111 2.184.741 4.052 1.768 5.606 3.079 1.553 1.312 2.768 2.867 3.647 4.665.878 1.8 1.317 3.735 1.317 5.808 0 1.44-.206 2.857-.619 4.253-.412 1.397-1.214 3.037-2.404 4.92s-2.347 3.163-3.468 3.84c-1.122.678-2.393 1.016-3.812 1.016-2.14 0-3.523-.529-4.147-1.587-1.026-1.651-1.349-3.111-.97-4.38.126-.677.505-2.242 1.138-4.697.084-.338.105-1.1.063-2.286 0-1.015-.106-1.861-.316-2.539-.21-.676-.674-1.015-1.39-1.015-1.727 0-3.202.412-4.425 1.238-1.221.824-2.264 1.904-3.127 3.236-.864 1.334-1.717 3.217-2.56 5.651-.843 2.433-1.443 4.474-1.802 6.125-.357 1.65-.579 3.227-.663 4.728-.084 1.503-.126 2.762-.126 3.778 0 1.523.137 3.11.41 4.76.275 1.651.822 3.164 1.643 4.538.821 1.376 1.886 2.519 3.192 3.428 1.306.911 2.991 1.365 5.056 1.365 2.031 0 4.274-.624 6.728-1.873 2.455-1.247 4.92-2.824 7.396-4.728s4.834-3.999 7.077-6.284 4.168-4.444 5.776-6.475c0 0 3.163-1.734 4.591.586zm-69.0691-39.4335c-3.725 0-6.475-.886-8.252-2.659s-2.666-4.132-2.666-7.08c0-.982.211-2.093.635-3.331.423-1.239 1.11-2.404 2.063-3.492.951-1.089 2.221-2.008 3.809-2.756 1.586-.747 3.564-1.121 5.934-1.121 1.481 0 2.877.171 4.19.512 1.311.343 2.454.866 3.428 1.571.972.704 1.745 1.633 2.317 2.786.57 1.154.856 2.521.856 4.101 0 1.452-.233 2.862-.698 4.229-.466 1.366-1.206 2.584-2.221 3.652-1.016 1.068-2.296 1.933-3.841 2.595-1.545.663-3.396.993-5.554.993z" fill-rule="evenodd" transform="translate(-5 -176)"/></svg>
  )
}
