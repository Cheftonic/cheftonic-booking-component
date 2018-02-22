import { Component} from '@stencil/core';

/**
 * Interface to configure this component
 * hourHeaderTranslateKey : Key to use for translation of the hours title
 * minuteHeaderTranslateKey : Key to use for translation of the minutes title
 * hoursToShow: Pre-filled array with the hours to show. If set, the next parameters are ignored.
 * from, to, showAllHours: If showAllHours is false, the component will only show the hours between from and to. If showAllHours is true, it will show 24 hours.
 */
export interface HourMinuteComponentConfig {
  bigHourMinute: boolean;
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

@Component({
  tag: 'cheftonic-hour-minute',
  styleUrl: 'hour-minute.scss'
})

export class HourMinuteComponent {

  hourMinuteConfig: HourMinuteComponentConfig;
  OonHourMinuteChange;// = new EventEmitter<string>();

  public hours: Array<string>;
  public minutes: Array<string> = ['00', '15', '30', '45'];
  public allTimes: Array<string>;

  public selectedHour: string;
  public selectedMinute: string;

  private defaultHourMinuteConfig: HourMinuteComponentConfig = {
    bigHourMinute: false,
    initialValue : '08:00',
    from : '00:00',
    to : '23:00',
    interval : MinutesInterval.QUARTERLY,
    showAllHours : true,
    hourHeaderTranslateKey : '',
    minuteHeaderTranslateKey : ''
  };

  constructor() {
    }

  ngOnInit() {
    this.initHourMinute();
  }

  ngOnChanges (changes) {
    console.log ('changed this: ' + JSON.stringify(changes, null, 2));
    this.hourMinuteConfig = <HourMinuteComponentConfig> changes.hourMinuteConfig.currentValue;

    this.initHourMinute();
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

    this.selectedHour = this.hourMinuteConfig.initialValue.split(':')[0];
    this.selectedMinute = this.hourMinuteConfig.initialValue.split(':')[1];

    // Now fill the hours to show
    if (this.hourMinuteConfig.hoursToShow) {
      this.hours = this.hourMinuteConfig.hoursToShow;
    } else {
      this.fillHours();
    }

    // If the smal version is required, we have to populate all the available times
    if (! this.hourMinuteConfig.bigHourMinute) {
      this.allTimes = this.hours.map ((hour) => this.minutes
        .map((minute) => hour + ':' + minute))
        .reduce((prev, act) =>  prev.concat(act), []);
    }
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

  setTime (time: string) {
    [this.selectedHour, this.selectedMinute] = time.split(':');
    this.emitTime();
  }

  setHour (hour: string) {
    this.selectedHour = hour;
    this.emitTime();
  }

  setMinute (minute: string) {
    this.selectedMinute = minute;
    this.emitTime();
  }

  emitTime() {
    //this.onHourMinuteChange.emit(this.selectedHour + ':' + this.selectedMinute);
  }

  /*isValidHour(hour) {
    if((Number(hour) < Number(this.hourMinuteConfig.from.split(':')[0])) || (Number(hour) > Number(this.hourMinuteConfig.to.split(':')[0]))){
      return false
    }
    else{return true}
  }*/

  /*isValidMinute(minute) {
    if((Number(minute) <= Number(this.hourMinuteConfig.from.split(':')[1])) && (this.selectedHour == this.hourMinuteConfig.from.split(':')[0]) ){
      return true
    }
    else{return false}
  }*/

  // #################################### CSS FUNCTIONS ####################################

  isSelectedHour(hour: string): string {
    return (hour === this.selectedHour) ? 'selectedButton' : '';
  }

  isSelectedMinute(minute: string): string {
    return (minute === this.selectedMinute) ? 'selectedButton' : '';

  }

}
