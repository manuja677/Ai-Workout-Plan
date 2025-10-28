export interface UserData {
  name: string;
  weight: string;
  height: string;
  freeDays: string[];
  gender: string;
  fitnessLevel: string;
  goal: string;
  equipment: string;
  maxSessionTime: string;
}

export interface Exercise {
  name: string;
  sets: string;
  reps: string;
  description: string;
  targetMuscles: string[];
}

export interface MuscleGroup {
  name: string;
  exercises: Exercise[];
}

export interface DailyWorkout {
  day: string;
  muscleGroups: MuscleGroup[];
  focus: string;
  approximateTime: string;
  caloriesBurned: number;
}

export type WorkoutPlan = DailyWorkout[];

export interface GeneratedPlan {
  plan: WorkoutPlan;
  summary: string;
  totalWeeklyTime: string;
  totalWeeklyCaloriesBurned: number;
  completedDays?: string[];
}

export interface WorkoutLog {
  date: string; // ISO string
  dayName: string;
  focus: string;
  caloriesBurned: number;
}

// Diet Plan Types
export interface Meal {
  name: string;
  description: string;
  calories: number;
}

export interface DailyDiet {
  day: string;
  meals: {
    breakfast: Meal;
    lunch: Meal;
    dinner: Meal;
    snack: Meal;
  };
  dailyTotals: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
}

export interface GeneratedDietPlan {
  summary: string;
  overallTargets: {
    dailyCalories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
  plan: DailyDiet[];
  disclaimer: string;
}

export interface User {
  username: string;
  password?: string; // Stored plaintext for this mock version. DO NOT DO THIS IN PRODUCTION.
}