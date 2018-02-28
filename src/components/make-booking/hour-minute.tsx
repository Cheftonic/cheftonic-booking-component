
/**
 * Interface to configure this component
 * hourHeaderTranslateKey : Key to use for translation of the hours title
 * minuteHeaderTranslateKey : Key to use for translation of the minutes title
 * hoursToShow: Pre-filled array with the hours to show. If set, the next parameters are ignored.
 * from, to, showAllHours: If showAllHours is false, the component will only show the hours between from and to. If showAllHours is true, it will show 24 hours.
 */
export interface HourMinuteConfig {
  initialValue?: string;
  from?: string;
  to?: string;
  showAllHours?: Boolean;
  hoursToShow?: string[];
  interval?: MinutesInterval;
  hourHeaderTranslateKey: string;
  minuteHeaderTranslateKey: string;
}

export enum MinutesInterval {
  QUARTERLY,
  HALF,
  FULL
}

export class HourMinute {

  hourMinuteConfig: HourMinuteConfig;
  OonHourMinuteChange;// = new EventEmitter<string>();

  public hours: Array<string>;
  public minutes: Array<string> = ['00', '15', '30', '45'];
  public allTimes: Array<string>;

  public selectedHour: string;
  public selectedMinute: string;

  private defaultHourMinuteConfig: HourMinuteConfig = {
    initialValue : '08:00',
    from : '00:00',
    to : '23:00',
    interval : MinutesInterval.QUARTERLY,
    showAllHours : true,
    hourHeaderTranslateKey : '',
    minuteHeaderTranslateKey : ''
  };

  constructor (public onSelectTime: Function) {}

  async setConfig (hourMinuteConfig:HourMinuteConfig) {
    if (hourMinuteConfig) {
      this.hourMinuteConfig = hourMinuteConfig;
      this.initHourMinute();
    }
  }

  initHourMinute() {
    // Merge incoming config with default config to ensure a complete config object
    this.hourMinuteConfig = {...this.defaultHourMinuteConfig, ...this.hourMinuteConfig};

    switch (this.hourMinuteConfig.interval) {
      case MinutesInterval.QUARTERLY:
        this.minutes = ['00', '15', '30', '45'];
        break;
      case MinutesInterval.HALF:
        this.minutes = ['00', '30'];
        break;
      case MinutesInterval.FULL:
        this.minutes = ['00'];
        break;
    }
    console.log ('Computed configuration: ' + this.hourMinuteConfig )

    this.selectedHour = this.hourMinuteConfig.initialValue.split(':')[0];
    this.selectedMinute = this.hourMinuteConfig.initialValue.split(':')[1];

    // Now fill the hours to show
    if (this.hourMinuteConfig.hoursToShow) {
      this.hours = this.hourMinuteConfig.hoursToShow;
    } else {
      this.fillHours();
    }
    console.log ('Hours to show: ' + this.hours)

    // Populate all the available times
    this.allTimes = this.hours.map ((hour) => this.minutes
      .map((minute) => hour + ':' + minute))
      .reduce((prev, act) =>  prev.concat(act), []);

  }

  fillHours() {
    let numHours = 24;
    if (!this.hourMinuteConfig.showAllHours) {
      // Get only available hours
      numHours = Number(this.hourMinuteConfig.to.split(':')[0]) - Number(this.hourMinuteConfig.from.split(':')[0]);
    }
    this.hours = Array(numHours).fill('').map(({index}) => {
      return ('0' + index).slice(-2);
    });
  }

  setTime (event) {
    console.log ('Time Selected: ' + event.target.textContent);
    [this.selectedHour, this.selectedMinute] = event.target.textContent.split(':');
    this.onSelectTime (event.target.textContent);
  }

  renderHourMinute() {
    return (
      <ul class="list">
        { this.allTimes.map (time => 
          <li value= {time} onClick={this.setTime.bind(this)} class="booking_time">
            { time }
          </li>
        )}
      
  </ul>
    )
  }

}
