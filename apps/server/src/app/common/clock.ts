export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock extends Clock {
  private currentTime: Date;

  constructor(startTime: Date) {
    super();
    this.currentTime = startTime;
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  advanceBy(milliseconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + milliseconds);
  }
}
