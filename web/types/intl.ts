export interface IntlWindow {
  id: string;
  label: string;
  start: string;
  end: string;
  status: "upcoming" | "live" | "complete";
  matches: number;
}

export interface IntlMatch {
  id: string;
  name: string;
  date: string;
  slug: string;
  competition: string;
  window: string;
  teams: string[];
}

/** One player's output in one international window. */
export interface IntlAppearance {
  player_id: string;
  window: string;
  name: string;
  club: string;
  league: string | null;
  nationality: string;
  position: string;
  age: number | null;
  matches: number;
  starts?: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  total_shots?: number;
  shots_on_target?: number;
  fouls_committed?: number;
  competitions: string[];
  injured: boolean;
}

export type InjuryKind = "forced_off" | "treated" | "withdrawn" | "training" | "listed";

export interface IntlInjury {
  player_id: string | null;
  name: string;
  nationality: string | null;
  club: string;
  league: string | null;
  window: string;
  date: string | null;
  match: string | null;
  competition: string | null;
  minute: string | null;
  kind: InjuryKind;
  injury: string | null;
  status: string | null;
  source: "match" | "manual" | "profile";
  source_url?: string | null;
  note?: string | null;
}

export interface IntlData {
  last_updated: string;
  windows: IntlWindow[];
  competitions: string[];
  matches: IntlMatch[];
  appearances: IntlAppearance[];
  injuries: IntlInjury[];
}
