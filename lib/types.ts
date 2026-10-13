export type BreakType = "beach" | "point" | "reef";

export type Coast =
  | "Santa Barbara / Isla Vista"
  | "California"
  | "Hawaii"
  | "East Coast"
  | "International";

/** How a Santa Barbara Channel break receives swell after the islands. */
export type ChannelWindow = {
  /** 0–1. How well this break focuses west-northwest swell that wraps at Point Conception. */
  westWrap: number;
  /** 0–1. How open this break is to south swell traveling up the channel. */
  south: number;
};

export type ChannelKind = "south" | "wrap" | "mixed" | "blocked";

export type Rating = "poor" | "fair" | "good" | "epic";

export type WindKind =
  | "glassy"
  | "offshore"
  | "cross-offshore"
  | "sideshore"
  | "cross-onshore"
  | "onshore";

export type TideStage = "low" | "mid" | "high";

export type TideTrend = "rising" | "falling" | "steady";

export type SwellSource = "primary" | "secondary" | "windsea" | "flat";

export type TideLink = {
  id: string;
  name: string;
  referenceId?: string;
  referenceName?: string;
  timeOffsetHighMin?: number;
  timeOffsetLowMin?: number;
  heightRatioHigh?: number;
  heightRatioLow?: number;
};

export type Spot = {
  id: string;
  name: string;
  place: string;
  coast: Coast;
  country: string;
  lat: number;
  lon: number;
  /** Compass degrees the beach looks out toward open water. 0 is north, 90 is east. */
  facing: number;
  breakType: BreakType;
  timezone: string;
  buoy?: { id: string; name: string };
  /** Shown with the buoy reading. Used when the nearest station is not the one with live waves. */
  buoyNote?: string;
  tide?: TideLink;
  /** Set for breaks inside the Santa Barbara Channel. */
  channel?: ChannelWindow;
  blurb: string;
};

export type ScorePoints = {
  direction: number;
  wind: number;
  period: number;
  tide: number;
};

export type DerivedHour = {
  time: string;
  faceFt: number;
  score: number;
  rawScore: number;
  rating: Rating;
  caps: string[];
  points: ScorePoints;
  swellHeightM: number;
  swellPeriodS: number;
  swellDir: number;
  otherSwellHeightM: number | null;
  swellAngle: number;
  swellSigned: number;
  swellSource: SwellSource;
  faceDiscount: number;
  channelKind: ChannelKind | null;
  /** Share of the offshore swell height that reaches this break. 1 outside the channel. */
  channelTransmission: number | null;
  secondaryHeightM: number | null;
  secondaryPeriodS: number | null;
  secondaryDir: number | null;
  windWaveHeightM: number | null;
  windWavePeriodS: number | null;
  windWaveDir: number | null;
  waveHeightM: number | null;
  windSpeedMs: number;
  windGustMs: number | null;
  windDir: number;
  windType: WindKind;
  tempC: number | null;
  precipProb: number | null;
  weatherCode: number | null;
  waterTempC: number | null;
  tideM: number | null;
  tideStage: TideStage | null;
  tideTrend: TideTrend | null;
};

export type SurfWindow = {
  start: string;
  end: string;
  score: number;
  rating: Rating;
  faceFt: number;
};

export type DayForecast = {
  date: string;
  sunrise: string | null;
  sunset: string | null;
  window: SurfWindow | null;
  maxFaceFt: number;
  minFaceFt: number;
};

export type TideExtreme = {
  time: string;
  heightM: number;
  kind: "high" | "low";
};

export type BuoyObservation = {
  id: string;
  name: string;
  observedAt: string;
  ageMinutes: number;
  waveHeightM: number | null;
  periodS: number | null;
  direction: number | null;
  windSpeedMs: number | null;
  windDir: number | null;
  gustMs: number | null;
  waterTempC: number | null;
  airTempC: number | null;
};

export type Forecast = {
  spotId: string;
  fetchedAt: string;
  timezone: string;
  today: string;
  hours: DerivedHour[];
  days: DayForecast[];
  nowIndex: number;
  buoy: BuoyObservation | null;
  buoyNote: string | null;
  tideExtremes: TideExtreme[];
  tideNote: string | null;
  waterTempC: number | null;
  waterTempSource: "buoy" | "model" | null;
};

export type NowSnapshot = {
  faceFt: number;
  score: number;
  rating: Rating;
  windType: WindKind;
  windSpeedMs: number;
  windDir: number;
  swellDir: number;
  swellPeriodS: number;
  swellHeightM: number;
  swellSource: SwellSource;
  tideStage: TideStage | null;
  fetchedAt: string;
};
