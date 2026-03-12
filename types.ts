export type UserRole = 'student' | 'teacher' | 'admin';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  moedas: number;
  vidas: number;
  streak: number;
  pontos: number;
  medalhas: number;
  role: UserRole;
}

export interface Course {
  id: string;
  nome: string;
  description: string;
  icon: string;
  order: number;
}

export interface Level {
  id: string;
  courseId: string;
  numero: number;
  titulo: string;
  difficulty?: DifficultyLevel;
}

export type QuestionType = 'theory' | 'practice' | 'code';

export interface Question {
  id: string;
  levelId: string;
  tipo: QuestionType;
  enunciado: string;
  opcoes?: string[];
  resposta: string;
  explicacao: string;
  codigo?: string;
  difficulty?: DifficultyLevel;
}

export interface UserProgress {
  concluido: boolean;
  score: number;
}

export interface Achievement {
  tipo: string;
  data_conquista: string;
}

export interface RankingEntry {
  userId: string;
  nome: string;
  pontos: number;
  streak: number;
  medalhas: number;
}
