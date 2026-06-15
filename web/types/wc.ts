export interface Player {
  player_id: number;
  name: string;
  club: string;
  nationality: string;
  age: number | null;
  birth_date: string | null;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Attacker" | string;
  photo: string | null;
  matches_played: number;
  minutes_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  shots_on_target: number;
  key_passes: number;
  goals_per_90: number | null;
  assists_per_90: number | null;
  goal_contributions_per_90: number | null;
}

export interface Club {
  club: string;
  player_count: number;
  total_goals: number;
  total_assists: number;
  total_goal_contributions: number;
  total_minutes: number;
  total_yellow_cards: number;
  total_red_cards: number;
  avg_age: number | null;
  ga_per_90: number | null;
  players: string[];
}

export interface WcMeta {
  nationalities: string[];
  clubs: string[];
  positions: string[];
}

export interface WcData {
  last_updated: string;
  players: Player[];
  clubs: Club[];
  meta: WcMeta;
}

export type SortStat = "goals" | "assists" | "total_goal_contributions" | "minutes_played" | "yellow_cards";
