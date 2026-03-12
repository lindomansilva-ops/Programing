import { Course } from './types';

export const COURSES: Course[] = [
  { id: 'algoritmos', nome: 'Algoritmos', description: 'Lógica fundamental e estruturas de dados.', icon: 'Code2', order: 1 },
  { id: 'java', nome: 'Java', description: 'Programação orientada a objetos com Java.', icon: 'Coffee', order: 2 },
  { id: 'html', nome: 'HTML', description: 'Estruturação de páginas web.', icon: 'Layout', order: 3 },
  { id: 'css', nome: 'CSS', description: 'Estilização e design responsivo.', icon: 'Palette', order: 4 },
  { id: 'javascript', nome: 'JavaScript', description: 'Interatividade no front-end.', icon: 'Zap', order: 5 },
  { id: 'sql', nome: 'SQL / MySQL', description: 'Bancos de dados relacionais.', icon: 'Database', order: 6 },
  { id: 'php', nome: 'PHP', description: 'Desenvolvimento back-end com PHP.', icon: 'Server', order: 7 },
  { id: 'python', nome: 'Python', description: 'Linguagem versátil e poderosa.', icon: 'Terminal', order: 8 },
  { id: 'csharp', nome: 'C#', description: 'Desenvolvimento com .NET.', icon: 'Hash', order: 9 },
  { id: 'projetos', nome: 'Projetos Práticos', description: 'Colocando tudo em prática.', icon: 'Briefcase', order: 10 },
];

export const INITIAL_LIVES = 5;
export const INITIAL_COINS = 0;
export const POINTS_PER_CORRECT = 10;
export const COINS_PER_CORRECT = 5;
export const LIFE_COST = 50;
