export interface BadgeDefinition {
  key: string;
  label: string;
  description: string;
  emoji: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { key: "first_section", label: "First Steps", description: "Read your first section", emoji: "👣" },
  { key: "first_module", label: "Module Master", description: "Complete your first module", emoji: "📚" },
  { key: "quiz_ace", label: "Quiz Ace", description: "Score 100% on a quiz", emoji: "🎯" },
  { key: "five_modules", label: "Knowledge Seeker", description: "Complete 5 modules", emoji: "🔍" },
  { key: "streak_3", label: "On Fire", description: "3-day learning streak", emoji: "🔥" },
  { key: "streak_7", label: "Week Warrior", description: "7-day learning streak", emoji: "⚔️" },
  { key: "streak_30", label: "Monthly Legend", description: "30-day learning streak", emoji: "🏆" },
  { key: "xp_100", label: "Centurion", description: "Earn 100 XP", emoji: "💯" },
  { key: "xp_500", label: "Rising Star", description: "Earn 500 XP", emoji: "�" },
  { key: "xp_1000", label: "Superstar", description: "Earn 1000 XP", emoji: "🌟" },
  { key: "all_paths", label: "Pathfinder", description: "Complete all path steps", emoji: "🗺️" },
];

export function getBadgeDefinition(key: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.key === key);
}
