export interface Player {
  player_id: number;
  name: string;
  club: string;
  league: string | null;
  nationality: string;
  age: number | null;
  dob: string | null;
  sun_sign: string | null;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward" | string;
  photo: string | null;
  matches_played: number;
  minutes_played: number;
  goals: number;
  decisive_goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  shots_on_target: number;
  total_shots: number;
  saves: number;
  fouls_committed: number;
  goals_conceded: number;
  shots_faced: number;
  clean_sheets: number;
  save_pct: number | null;
  goals_conceded_per_90: number | null;
  goals_per_90: number | null;
  assists_per_90: number | null;
  goal_contributions_per_90: number | null;
}

export interface Club {
  club: string;
  league: string | null;
  player_count: number;
  total_goals: number;
  total_decisive_goals: number;
  total_assists: number;
  total_goal_contributions: number;
  total_minutes: number;
  total_yellow_cards: number;
  total_red_cards: number;
  avg_age: number | null;
  goals_per_90: number | null;
  assists_per_90: number | null;
  ga_per_90: number | null;
  players: string[];
}

export interface WcMeta {
  nationalities: string[];
  clubs: string[];
  leagues: string[];
  positions: string[];
  sun_signs: string[];
  matchdays: string[];
}

export interface WcData {
  last_updated: string;
  players: Player[];
  clubs: Club[];
  meta: WcMeta;
  club_timeseries: Record<string, { goals: number[]; assists: number[]; ga: number[] }>;
}
