import { MasterDataProvider } from '../../providers/providers';
import { MasterDataKeys } from '../../providers/master-data/master-data';

/**
 * dateFrom: Date - If set, means the first day that can be selected on this calendar, and the calendar goes from this day forward.
 */
export class CalendarConfig {
  dateFrom?: Date;
  multiSelection?: Boolean;
  selectedDays?: Date[];
  disabledDays?: Date[];
  weekdaysEnabled?: string[];
  todayTomorrow?: Boolean;
}

class CalendarDay {
  weekDayNr: number;
  weekDayName: string;
  dayOfMonth: number;
  monthNr: number;
  date: Date;
}

export class Calendar {

  private inputCalendarConfig: CalendarConfig = {};

  public weekdays: Array<{key: string, value: string}>;
  public months: Array<{key: string, value: string}>;

  public parsedDates = {monthName: '', week: [{day: new Array<CalendarDay>()}]};
  public today: Date = new Date();
  public selectedYear: number;
  public selectedMonth: number;
  public selected_dates: Set <string> = new Set <string>(); // ISO date string
  public disabled_dates: Set <string> = new Set <string>(); // ISO date string
  private weekdayIndex = new Array<string>(7);
  public calendarConfig: CalendarConfig = {
    dateFrom : this.today,
    disabledDays : [],
    multiSelection : true,
    todayTomorrow : false
  };

  constructor (
    private masterData: MasterDataProvider,
    public onSelectDay: Function,
    public onMonthChange: Function) {
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

  private async getCalendarMD () {
    return Promise.all ([
      this.masterData.getMasterDataInfo(MasterDataKeys.WEEKDAYS),
      this.masterData.getMasterDataInfo(MasterDataKeys.MONTHS)
    ])
  }

  async setConfig (calConfig: CalendarConfig) {
    console.log ('Setting calendar to this config: ' + JSON.stringify(calConfig, null, 2));
    this.calendarConfig = calConfig;
    if (!this.weekdays || !this.months) {
      [this.weekdays, this.months] = await this.getCalendarMD();
    }
    if (this.calendarConfig && this.weekdays && this.months) {
      // Save new values
      this.selectedMonth = this.calendarConfig.dateFrom.getMonth();
      this.selectedYear = this.calendarConfig.dateFrom.getFullYear();
      // Reset parsedDates and generate new dates
      this.parsedDates = {monthName: '', week: [{day: new Array<CalendarDay>()}]};

      this.initCalendar();
    }
  }

  initCalendar() {
    this.calendarConfig = {...this.calendarConfig, ...this.inputCalendarConfig};

    console.log ('Calendar effective config: ' + JSON.stringify (this.calendarConfig, null, 2));

    if (this.calendarConfig && this.calendarConfig.disabledDays) {
      this.disabled_dates = new Set(this.calendarConfig.disabledDays.map(day => {
          day.setHours(12, 0, 0, 0);
          return day.toISOString();
        }
      ));
    }

    if (this.calendarConfig && this.calendarConfig.selectedDays) {
      this.selected_dates = new Set(this.calendarConfig.selectedDays.map(day => {
          day.setHours(12, 0, 0, 0);
          return day.toISOString();
        }
      ));
    }

    this.generateDates();
  }

  // #################################### CALENDAR FUNCTIONS ####################################

  daysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
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
      // Check if the DoW is 1, in which case we need to start a new line *except* if the first DoM is Monday
      if ((newDate.getDay() === 1) && (newDate.getDate() > 1)) {
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

  previousMonth(event) {
    console.log (event)
    /*
    The back button is enabled by default, and checks if it can go backwards in every click
    */
    if (this.isBackAllowed()) {
      const date = new Date(this.selectedYear, this.selectedMonth, 1);
      // Go to previous month
      date.setMonth(date.getMonth() - 1);
      // Emit the change
      this.onMonthChange (date);
    }
  }

  nextMonth(event) {
    console.log (event)
    const date = new Date(this.selectedYear, this.selectedMonth, 1);
    // Go to next month
    date.setMonth(date.getMonth() + 1);
    // Emit the change
    this.onMonthChange (date);
  }

  isBackAllowed() {
    /*
     * Can go backwards if:
     * 1. If the parameter dateFrom IS NOT SET, it is possible to go back and forth without restrictions
     * 2. If the parameter dateFrom IS SET, the user can go backwards ONLY if the month being displayed is greater than the current (consider years)
     */
    return (this.calendarConfig.dateFrom) ?
    (this.getFirstDayOfMonth (this.selectedYear, this.selectedMonth) > this.getFirstDayOfMonth (this.today.getFullYear(), this.today.getMonth())) : true;
  }

  private getFirstDayOfMonth (year: number, month: number): Date {
    const date = new Date(year, month + 1, 1);
    return date;
  }
  // #################################### SELECTED DATES FUNCTIONS ####################################

  assignDate(event) {

    const date = new Date(event.target.id);

    // Check if multiSelection is enabled
    if (!this.calendarConfig.multiSelection) {
      this.selected_dates.clear();
    }
    // Add selected date to selected dates
    if (!this.selected_dates.has(date.toISOString())) {
      this.selected_dates.add(date.toISOString());
    } else {
      this.selected_dates.delete(date.toISOString());
    }
    this.onSelectDay (Array.from(this.selected_dates).map(d => new Date(d)));
  }

  // #################################### CSS FUNCTIONS ####################################

  isSelectedDay (date: Date): string {
    return (this.selected_dates.has(date.toISOString())) ? 'selectedButton' : '';
  }

  isDisabled(calDay: CalendarDay): boolean {
    return this.disabled_dates.has(calDay.date.toISOString()) ||
      // Depends on the weekdays which are enabled or not
      ((this.calendarConfig.weekdaysEnabled) ? (this.calendarConfig.weekdaysEnabled.indexOf(calDay.weekDayName) < 0) : false) ||
      // Depends on the dateFrom, if set, disable the past days from that day. If not set don't disable days from this parameter
      ((this.calendarConfig.dateFrom) ? (this.differenceInDays (calDay.date, this.calendarConfig.dateFrom) > 0) :  false);
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

  renderCalendar() {
    return (
      <div class="calendar_box popup">
        <div class="arrow"></div>
        <div class="calendar_header">
          <div class="calendar_nav--prev">
            <button type="button"
              onClick = {this.previousMonth.bind(this)}>
              <svg height="10" viewBox="0 0 56 100" width="5.6" xmlns="http://www.w3.org/2000/svg"><path d="m45.6195417 76.1916897-43.80544294-43.6532449c-2.41879835-2.4103944-2.41879835-6.3195686 0-8.730649 2.41948667-2.4103944 6.34229025-2.4103944 8.76108864 0l39.4248986 39.2879204 39.4248987-39.2879204c2.4187984-2.4103944 6.3416019-2.4103944 8.7604003 0 2.419487 2.4110804 2.419487 6.3202546 0 8.730649l-43.8047547 43.6532449c-2.4194866 2.4110804-6.3416019 2.4110804-8.7610886 0" fill="#231f20" fill-rule="evenodd" transform="matrix(0 1 -1 0 78 0)"/></svg>
            </button>
          </div>
          <div class="calendar_month">{ this.parsedDates.monthName }</div>
          <div class="calendar_year">{ this.selectedYear }</div>
          <div class="calendar_nav--next">
            <button ion-button icon-only type="button"
              onClick = {this.nextMonth.bind(this)}>
              <svg height="10" viewBox="0 0 56 100" width="5.6" xmlns="http://www.w3.org/2000/svg"><path d="m45.6195417 76.1916897-43.80544294-43.6532449c-2.41879835-2.4103944-2.41879835-6.3195686 0-8.730649 2.41948667-2.4103944 6.34229025-2.4103944 8.76108864 0l39.4248986 39.2879204 39.4248987-39.2879204c2.4187984-2.4103944 6.3416019-2.4103944 8.7604003 0 2.419487 2.4110804 2.419487 6.3202546 0 8.730649l-43.8047547 43.6532449c-2.4194866 2.4110804-6.3416019 2.4110804-8.7610886 0" fill="#231f20" fill-rule="evenodd" transform="matrix(0 -1 1 0 -22 100)"/></svg>
            </button>
          </div>
        </div>
        <table class="calendar_table">
          <thead>
            <tr>
            { ['L','M','X','J','V','S','D'].map (day =>
            <th class="calendar_weekday" scope="col">{ day }</th>
            )}
            </tr>
          </thead>
          <tbody>
          {
          this.parsedDates.week.map (week =>
            <tr>
              { [1,2,3,4,5,6,0].map (wd => this.printWeekDay (week, wd))}
            </tr>
          )
        }
          </tbody>
        </table>
      </div>
    )
  }

  private printWeekDay(week, wd) {
    if ((week.day[wd])  && ! this.isDisabled(week.day[wd])) {
      return (
        <td role="presentation">
          <div class = {'day-small active'.concat(this.isSelectedDay(week.day[wd].date))}  id={ week.day[wd].date } onClick = {this.assignDate.bind(this)}>
          { week.day[wd].dayOfMonth }
          </div>
        </td>
      )
    } else {
      if (week.day[wd]) {
        return (
          <td role="presentation">
            <div class="day-small day-disabled" id="day">
              <span>{ week.day[wd].dayOfMonth }</span>
            </div>
          </td>
        )
      } else {
        return (
          <td role="presentation">
            <div class="day-small" id="day">
            </div>
          </td>
        )
      }
    }
  }
}
