import { Component } from '@stencil/core';

import { MasterDataProvider } from '../../providers/providers';
import { MasterDataKeys } from '../../providers/master-data/master-data';

/**
 * dateFrom: Date - If set, means the first day that can be selected on this calendar, and the calendar goes from this day forward.
 */
export interface CalendarComponentConfig {
  bigCalendar?: Boolean;
  dateFrom?: Date;
  multiSelection?: Boolean;
  selectedDays?: Date[];
  disabledDays?: Date[];
  weekdaysEnabled?: string[];
  todayTomorrow?: Boolean;
}

/*class CalendarMonth {
  monthNr: number
  monthName: string
  weeks: Array<CalendarWeek>
  constructor() {
    this.weeks = new Array<CalendarWeek>()
  }
}
class CalendarWeek {
  weekNumber: number
  days: Array<CalendarDay>
  constructor() {
    this.days = new Array<CalendarDay>()
  }
}*/

class CalendarDay {
  weekDayNr: number;
  weekDayName: string;
  dayOfMonth: number;
  monthNr: number;
  date: Date;
}

class TodayTomorrowDay extends CalendarDay {
  monthName: string;
}

@Component({
  tag: 'cheftonic-calendar',
  styleUrl: 'calendar.scss'
})
export class CalendarComponent {

  inputCalendarConfig: CalendarComponentConfig = {};
  onCalendarChange;// = new EventEmitter<Array<Date>>();
  onMonthChange;// = new EventEmitter<Date>();

  public weekdays: Array<{key: string, value: string}>;
  public months: Array<{key: string, value: string}>;

  public parsedDates = {monthName: '', week: [{day: new Array<CalendarDay>()}]};
  public parsedTodayTomorrow: Array<TodayTomorrowDay>;
  public today: Date = new Date();
  public selectedYear: number;
  public selectedMonth: number;
  public selected_dates: Set <string> = new Set <string>(); // ISO date string
  public disabled_dates: Set <string> = new Set <string>(); // ISO date string
  private weekdayIndex = new Array<string>(7);
  public defaultCalendarConfig: CalendarComponentConfig = {
    bigCalendar: true,
    dateFrom : this.today,
    disabledDays : [],
    multiSelection : true,
    todayTomorrow : false
  };

  constructor (
    private masterData: MasterDataProvider) {
      // Reset today to noon
      this.today.setHours (12, 0, 0, 0);
      // Set current Date values
      this.selectedYear = this.today.getFullYear();
      this.selectedMonth = this.today.getMonth();
      // Init weekdays array
      this.weekdayIndex[0] = 'sunday';
      this.weekdayIndex[1] = 'monday';
      this.weekdayIndex[2] = 'tuesday';
      this.weekdayIndex[3] = 'wednesday';
      this.weekdayIndex[4] = 'thursday';
      this.weekdayIndex[5] = 'friday';
      this.weekdayIndex[6] = 'saturday';
  }

  async ngOnInit() {
    this.weekdays = await this.masterData.getMasterDataInfo(MasterDataKeys.WEEKDAYS);
    this.months = await this.masterData.getMasterDataInfo(MasterDataKeys.MONTHS);
    this.initCalendar();
  }

  ngOnChanges (changes) {
    console.log ('changed this: ' + JSON.stringify(changes, null, 2));
    this.defaultCalendarConfig = <CalendarComponentConfig> changes.inputCalendarConfig.currentValue;
    if (this.defaultCalendarConfig && this.weekdays && this.months) {
      // Save new values
      this.selectedMonth = this.defaultCalendarConfig.dateFrom.getMonth();
      this.selectedYear = this.defaultCalendarConfig.dateFrom.getFullYear();
      // Reset parsedDates and generate new dates
      this.parsedDates = {monthName: '', week: [{day: new Array<CalendarDay>()}]};
      this.initCalendar();
    }
  }

  initCalendar() {
    this.defaultCalendarConfig = {...this.defaultCalendarConfig, ...this.inputCalendarConfig};

    if (this.defaultCalendarConfig && this.defaultCalendarConfig.disabledDays) {
      this.disabled_dates = new Set(this.defaultCalendarConfig.disabledDays.map(day => {
          day.setHours(12, 0, 0, 0);
          return day.toISOString();
        }
      ));
    }

    if (this.defaultCalendarConfig && this.defaultCalendarConfig.selectedDays) {
      this.selected_dates = new Set(this.defaultCalendarConfig.selectedDays.map(day => {
          day.setHours(12, 0, 0, 0);
          return day.toISOString();
        }
      ));
    }
    this.generateDates();
    if (this.defaultCalendarConfig.todayTomorrow) {
      // Set today & tomorrow values
      this.setTodayTomorrow();
    }
  }

  // #################################### CALENDAR FUNCTIONS ####################################

  daysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
  }

  setTodayTomorrow() {

    const todayObj = new TodayTomorrowDay();
    todayObj.weekDayNr = this.today.getDay();
    todayObj.weekDayName = this.weekdays.find(i => i.key === this.weekdayIndex[this.today.getDay()]).value;
    todayObj.monthNr = this.today.getMonth();
    todayObj.monthName = this.months[this.today.getMonth()].value;
    todayObj.dayOfMonth = this.today.getDate();
    todayObj.date = new Date(this.today);

    const tomorrow = new Date(this.today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowObj = new TodayTomorrowDay();
    tomorrowObj.weekDayNr = tomorrow.getDay();
    tomorrowObj.weekDayName = this.weekdays.find(i => i.key === this.weekdayIndex[tomorrow.getDay()]).value;
    tomorrowObj.monthNr = tomorrow.getMonth();
    tomorrowObj.monthName = this.months[tomorrow.getMonth()].value;
    tomorrowObj.dayOfMonth = tomorrow.getDate();
    tomorrowObj.date = new Date(tomorrow);

    this.parsedTodayTomorrow = new Array<TodayTomorrowDay>();
    this.parsedTodayTomorrow.push(todayObj, tomorrowObj);
  }

  generateDates() {
    // Generate Full month parsed dates
    let currentWeek = 0;
    this.parsedDates.monthName = this.months[this.selectedMonth].value;
    const newDate: Date = new Date();
    newDate.setHours(12, 0, 0, 0);
    newDate.setMonth(this.selectedMonth);
    newDate.setFullYear(this.selectedYear);
    const monthDays = this.daysInMonth(this.selectedMonth + 1, this.selectedYear);
    for (let i = 1; i <= monthDays; i++) {
      let weekDay;
      newDate.setDate(i);
      if (newDate.getDay() === 1) {
        // New Week line
        currentWeek++;
        this.parsedDates.week.push({day: new Array<CalendarDay>()});
      }
      // Push day to current weekDayName
      weekDay = newDate.getDay();
      this.parsedDates.week[currentWeek].day[weekDay] = {
        weekDayNr: newDate.getDay(),
        weekDayName: this.weekdayIndex[newDate.getDay()],
        dayOfMonth: newDate.getDate(),
        monthNr: newDate.getMonth(),
        date: new Date(newDate)
      };
    }
    console.log(this.parsedDates);
  }

  previousMonth() {
    /*
    The back button is enabled by default, and checks if it can go backwards in every click
    */
    if (this.isBackAllowed()) {
      const date = new Date(this.selectedYear, this.selectedMonth, 1);
      // Go to previous month
      date.setMonth(date.getMonth() - 1);
      // Emit the change
      this.onMonthChange.emit (date);
    }
  }

  nextMonth() {
    const date = new Date(this.selectedYear, this.selectedMonth, 1);
    // Go to next month
    date.setMonth(date.getMonth() + 1);
    // Emit the change
    this.onMonthChange.emit (date);
  }

  isBackAllowed() {
    /*
     * Can go backwards if:
     * 1. If the parameter dateFrom IS NOT SET, it is possible to go back and forth without restrictions
     * 2. If the parameter dateFrom IS SET, the user can go backwards ONLY if the month being displayed is greater than the current (consider years)
     */
    return (this.defaultCalendarConfig.dateFrom) ?
    (this.getFirstDayOfMonth (this.selectedYear, this.selectedMonth) > this.getFirstDayOfMonth (this.today.getFullYear(), this.today.getMonth())) : true;
  }

  private getFirstDayOfMonth (year: number, month: number): Date {
    const dateString = year + '-' + (month + 1) + '-01';
    const date = new Date(dateString);
    return date;
  }
  // #################################### SELECTED DATES FUNCTIONS ####################################

  assignDate(date: Date) {
    // Check if multiSelection is enabled
    if (!this.defaultCalendarConfig.multiSelection) {
      this.selected_dates.clear();
    }
    // Add selected date to selected dates
    if (!this.selected_dates.has(date.toISOString())) {
      this.selected_dates.add(date.toISOString());
    } else {
      this.selected_dates.delete(date.toISOString());
    }
    this.onCalendarChange.emit(Array.from(this.selected_dates).map(d => new Date(d)));
  }

  // #################################### CSS FUNCTIONS ####################################

  isSelectedDay (date: Date): string {
    return (this.selected_dates.has(date.toISOString())) ? 'selectedButton' : '';
  }

  isDisabled(calDay: CalendarDay): boolean {
    return this.disabled_dates.has(calDay.date.toISOString()) ||
      // Depends on the weekdays which are enabled or not
      ((this.defaultCalendarConfig.weekdaysEnabled) ? (this.defaultCalendarConfig.weekdaysEnabled.indexOf(calDay.weekDayName) < 0) : false) ||
      // Depends on the dateFrom, if set, disable the past days from that day. If not set don't disable days from this parameter
      ((this.defaultCalendarConfig.dateFrom) ? (this.differenceInDays (calDay.date, this.defaultCalendarConfig.dateFrom) > 0) :  false);
  }

  /**
   * From https://stackoverflow.com/questions/33644871/javascript-comparing-dates-without-time
   * @param d0
   * @param d1
   */
  private differenceInDays(d0, d1) {
    // Copy dates so don't affect originals
    d0 = new Date(+d0);
    d1 = new Date(+d1);

    // Set to noon
    d0.setHours(12, 0, 0, 0);
    d1.setHours(12, 0, 0, 0);

    // Get difference in whole days, divide by milliseconds in one day
    // and round to remove any daylight saving boundary effects
    return Math.round((d1 - d0) / 8.64e7);
  }

}
