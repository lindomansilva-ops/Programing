import React, { useState, useEffect } from 'react';
import { 
  auth, db 
} from './firebase';
import { generateQuestions } from './services/geminiService';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit,
  addDoc,
  getDocs,
  writeBatch,
  updateDoc,
  increment
} from 'firebase/firestore';
import { 
  BookOpen, 
  Trophy, 
  User as UserIcon, 
  Heart, 
  Coins, 
  Flame, 
  ChevronRight, 
  CheckCircle2, 
  XCircle,
  LogOut,
  LayoutDashboard,
  GraduationCap,
  Settings,
  Menu,
  X,
  Code2,
  Coffee,
  Layout,
  Palette,
  Zap,
  Database,
  Server,
  Terminal,
  Hash,
  Briefcase,
  Users,
  Edit,
  Trash2,
  Plus,
  Search,
  Eye,
  ShieldCheck,
  BarChart3,
  ListFilter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COURSES, INITIAL_LIVES, INITIAL_COINS } from './constants';
import { UserProfile, Course, Level, Question, UserProgress, RankingEntry, UserRole, DifficultyLevel } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md active:scale-95',
      secondary: 'bg-blue-500 text-white hover:bg-blue-600 shadow-md active:scale-95',
      outline: 'border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 active:scale-95',
      ghost: 'text-gray-600 hover:bg-gray-100 active:scale-95',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-2xl shadow-sm border border-gray-100 p-6', className)}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning'; className?: string }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-600',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-orange-100 text-orange-600',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider', variants[variant], className)}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'courses' | 'dashboard' | 'ranking' | 'admin'>('courses');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen for real-time profile updates
        unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            setProfile({ uid: firebaseUser.uid, ...snapshot.data() } as UserProfile);
            setLoading(false);
          } else {
            // Create profile if it doesn't exist (e.g. first Google login)
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              nome: firebaseUser.displayName || 'Estudante',
              email: firebaseUser.email || '',
              moedas: INITIAL_COINS,
              vidas: INITIAL_LIVES,
              streak: 0,
              pontos: 0,
              medalhas: 0,
              role: firebaseUser.email === 'olindo99@gmail.com' ? 'admin' : 'student',
            };
            await setDoc(userRef, newProfile);
            
            // Add to ranking
            await setDoc(doc(db, 'ranking', firebaseUser.uid), {
              userId: firebaseUser.uid,
              nome: newProfile.nome,
              pontos: 0,
              streak: 0,
              medalhas: 0
            });
            // onSnapshot will trigger again and set the profile
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setCourses([]);
      setCoursesLoading(false);
      return;
    }
    setCoursesLoading(true);
    const q = query(collection(db, 'courses'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        const isAdmin = user.email === 'olindo99@gmail.com' || profile?.role === 'admin';
        if (isAdmin) {
          try {
            const batch = writeBatch(db);
            COURSES.forEach(course => {
              const courseRef = doc(db, 'courses', course.id);
              batch.set(courseRef, course);
            });
            await batch.commit();
          } catch (err) {
            console.error("Error seeding courses:", err);
            setCoursesLoading(false);
          }
        } else {
          setCourses([]);
          setCoursesLoading(false);
        }
      } else {
        setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
        setCoursesLoading(false);
      }
    }, (err) => {
      console.error("Error fetching courses:", err);
      setCoursesLoading(false);
    });
    return unsubscribe;
  }, [user, profile?.role]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          nome: nome,
          email: email,
          moedas: INITIAL_COINS,
          vidas: INITIAL_LIVES,
          streak: 0,
          pontos: 0,
          medalhas: 0,
          role: email === 'olindo99@gmail.com' ? 'admin' : 'student',
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
        
        // Add to ranking
        await setDoc(doc(db, 'ranking', firebaseUser.uid), {
          userId: firebaseUser.uid,
          nome: nome,
          pontos: 0,
          streak: 0,
          medalhas: 0
        });
        
        setProfile(newProfile);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <GraduationCap className="w-12 h-12 text-emerald-500" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-200">
                <GraduationCap className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Algoritmolândia</h1>
            <p className="text-slate-500 italic">Por Prof. Valter Almeida</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">Nome Completo</label>
                  <input 
                    type="text" 
                    required 
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Seu nome"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">E-mail</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">Senha</label>
                  {authMode === 'login' && (
                    <button 
                      type="button"
                      onClick={async () => {
                        if (!email) {
                          setError('Por favor, insira seu e-mail primeiro.');
                          return;
                        }
                        try {
                          await sendPasswordResetEmail(auth, email);
                          setError('E-mail de redefinição enviado!');
                        } catch (err: any) {
                          setError(err.message);
                        }
                      }}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
              <Button type="submit" className="w-full py-4 text-lg">
                {authMode === 'login' ? 'Entrar' : 'Criar Conta'}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Ou continue com</span></div>
            </div>

            <Button variant="outline" onClick={handleGoogleLogin} className="w-full py-3 border-slate-200 text-slate-600 hover:bg-slate-50">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-2" alt="Google" />
              Google
            </Button>

            <p className="text-center mt-6 text-sm text-slate-500">
              {authMode === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="ml-1 text-emerald-600 font-bold hover:underline"
              >
                {authMode === 'login' ? 'Cadastre-se' : 'Faça Login'}
              </button>
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedCourse(null); setSelectedLevel(null); setActiveTab('courses'); }}>
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">Algoritmolândia</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 text-orange-500 font-bold">
              <Flame className="w-5 h-5 fill-current" />
              <span>{profile?.streak || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 text-yellow-500 font-bold">
              <Coins className="w-5 h-5 fill-current" />
              <span>{profile?.moedas || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-500 font-bold">
              <Heart className="w-5 h-5 fill-current" />
              <span>{profile?.vidas || 0}</span>
            </div>
            
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />
            
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-500 hover:scale-105 transition-transform"
            >
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.email}`} alt="Profile" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {selectedLevel ? (
            <LevelView 
              level={selectedLevel} 
              profile={profile!} 
              onClose={() => setSelectedLevel(null)} 
            />
          ) : selectedCourse ? (
            <CourseView 
              course={selectedCourse} 
              onLevelSelect={setSelectedLevel} 
              onBack={() => setSelectedCourse(null)} 
            />
          ) : (
            <div key="home" className="space-y-8">
              {/* Tabs */}
              <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit">
                <button 
                  onClick={() => setActiveTab('courses')}
                  className={cn('px-6 py-2 rounded-xl font-medium transition-all', activeTab === 'courses' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700')}
                >
                  Cursos
                </button>
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={cn('px-6 py-2 rounded-xl font-medium transition-all', activeTab === 'dashboard' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700')}
                >
                  Meu Progresso
                </button>
                <button 
                  onClick={() => setActiveTab('ranking')}
                  className={cn('px-6 py-2 rounded-xl font-medium transition-all', activeTab === 'ranking' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700')}
                >
                  Ranking
                </button>
                {(profile?.role === 'teacher' || profile?.role === 'admin') && (
                  <button 
                    onClick={() => setActiveTab('teacher')}
                    className={cn('px-6 py-2 rounded-xl font-medium transition-all', activeTab === 'teacher' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700')}
                  >
                    Painel Professor
                  </button>
                )}
                {profile?.role === 'admin' && (
                  <button 
                    onClick={() => setActiveTab('admin')}
                    className={cn('px-6 py-2 rounded-xl font-medium transition-all', activeTab === 'admin' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700')}
                  >
                    Painel Admin
                  </button>
                )}
              </div>

              {activeTab === 'courses' && (
                <div className="space-y-6">
                  {coursesLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <GraduationCap className="w-10 h-10 text-emerald-500 opacity-50" />
                      </motion.div>
                      <p className="text-slate-400 animate-pulse">Carregando cursos...</p>
                    </div>
                  ) : courses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {courses.map((course) => (
                        <div key={course.id}>
                          <CourseCard 
                            course={course} 
                            onClick={() => setSelectedCourse(course)} 
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                      <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-slate-400">Nenhum curso disponível</h3>
                      <p className="text-slate-400 text-sm">Contate um administrador para adicionar conteúdo.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'dashboard' && <DashboardView profile={profile!} />}
              {activeTab === 'ranking' && <RankingView />}
              {activeTab === 'teacher' && <TeacherView profile={profile!} />}
              {activeTab === 'admin' && <AdminView profile={profile!} />}
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Side Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-white z-[70] shadow-2xl p-6 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold">Perfil</h2>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col items-center text-center space-y-4 mb-8">
                <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-emerald-500">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.email}`} alt="Profile" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{profile?.nome}</h3>
                  <p className="text-slate-500 text-sm">{profile?.email}</p>
                  <Badge variant={profile?.role === 'admin' ? 'warning' : profile?.role === 'teacher' ? 'success' : 'default'} className="mt-2">
                    {profile?.role === 'admin' ? 'Administrador' : profile?.role === 'teacher' ? 'Professor' : 'Estudante'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 flex-1">
                <button 
                  onClick={() => { setActiveTab('courses'); setIsMenuOpen(false); }}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all', activeTab === 'courses' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-50 text-slate-700')}
                >
                  <BookOpen className="w-5 h-5" />
                  <span>Cursos</span>
                </button>
                <button 
                  onClick={() => { setActiveTab('dashboard'); setIsMenuOpen(false); }}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all', activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-50 text-slate-700')}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span>Meu Progresso</span>
                </button>
                <button 
                  onClick={() => { setActiveTab('ranking'); setIsMenuOpen(false); }}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all', activeTab === 'ranking' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-50 text-slate-700')}
                >
                  <Trophy className="w-5 h-5" />
                  <span>Ranking Global</span>
                </button>
                {(profile?.role === 'teacher' || profile?.role === 'admin') && (
                  <button 
                    onClick={() => { setActiveTab('teacher'); setIsMenuOpen(false); }}
                    className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all', activeTab === 'teacher' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-50 text-slate-700')}
                  >
                    <GraduationCap className="w-5 h-5" />
                    <span>Painel Professor</span>
                  </button>
                )}
                {profile?.role === 'admin' && (
                  <button 
                    onClick={() => { setActiveTab('admin'); setIsMenuOpen(false); }}
                    className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all', activeTab === 'admin' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-50 text-slate-700')}
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span>Painel Admin</span>
                  </button>
                )}
              </div>

              <Button variant="outline" onClick={handleLogout} className="mt-auto border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300">
                <LogOut className="w-5 h-5" />
                Sair da Conta
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Views ---

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const Icon = {
    Code2, Coffee, Layout, Palette, Zap, Database, Server, Terminal, Hash, Briefcase
  }[course.icon] || Code2;

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-emerald-100 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
          <Icon className="w-8 h-8 text-emerald-500 group-hover:text-white transition-colors" />
        </div>
        <div className="text-slate-300 group-hover:text-emerald-500 transition-colors">
          <ChevronRight className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-xl font-bold mb-2">{course.nome}</h3>
      <p className="text-slate-500 text-sm line-clamp-2">{course.description}</p>
      
      <div className="mt-6 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>10 NÍVEIS</span>
        <div className="flex items-center gap-1">
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="w-1/3 h-full bg-emerald-500" />
          </div>
          <span className="text-emerald-500">33%</span>
        </div>
      </div>
    </motion.div>
  );
}

function CourseView({ course, onLevelSelect, onBack }: { course: Course; onLevelSelect: (l: Level) => void; onBack: () => void }) {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('easy');
  
  const levels = Array.from({ length: 10 }, (_, i) => ({
    id: `${course.id}-level-${i + 1}-${difficulty}`,
    courseId: course.id,
    numero: i + 1,
    titulo: `Nível ${i + 1}: ${i === 0 ? 'Introdução' : 'Conceitos Intermediários'}`,
    difficulty
  }));

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold">{course.nome}</h2>
            <p className="text-slate-500">Mapa de Aprendizado</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center">
          {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize",
                difficulty === d 
                  ? "bg-white text-emerald-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : 'Difícil'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center space-y-8 relative">
        <div className="absolute top-0 bottom-0 w-2 bg-slate-200 left-1/2 -translate-x-1/2 z-0 rounded-full" />
        
        {levels.map((level, idx) => (
          <motion.div 
            key={level.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="relative z-10"
          >
            <button 
              onClick={() => onLevelSelect(level)}
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg transition-all hover:scale-110",
                idx === 0 ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-white text-slate-400 border-4 border-slate-200"
              )}
            >
              {level.numero}
            </button>
            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 whitespace-nowrap bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 hidden sm:block">
              <p className="font-bold text-sm">{level.titulo}</p>
              <p className="text-xs text-slate-400">0/19 Exercícios</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function LevelView({ level, profile, onClose }: { level: Level; profile: UserProfile; onClose: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [vidas, setVidas] = useState(profile.vidas);
  const [moedas, setMoedas] = useState(profile.moedas);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      const q = query(
        collection(db, 'courses', level.courseId, 'levels', level.id, 'questions'),
        where('difficulty', '==', level.difficulty || 'easy'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      let fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      
      if (fetched.length === 0) {
        // Tenta buscar sem filtro de dificuldade caso não existam questões específicas
        const fallbackQ = query(
          collection(db, 'courses', level.courseId, 'levels', level.id, 'questions'),
          limit(20)
        );
        const fallbackSnapshot = await getDocs(fallbackQ);
        fetched = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      }

      if (fetched.length === 0) {
        // Se ainda estiver vazio, gera via IA se for um nível padrão ou mostra fallback
        setQuestions([
          {
            id: 'fallback-1',
            levelId: level.id,
            tipo: 'theory',
            enunciado: `O que é um algoritmo? (${level.difficulty})`,
            opcoes: ['Hardware', 'Sequência de instruções', 'Erro', 'Linguagem'],
            resposta: 'Sequência de instruções',
            explicacao: 'Algoritmos são sequências lógicas de passos.',
            difficulty: level.difficulty
          }
        ]);
      } else {
        setQuestions(fetched);
      }
      setLoading(false);
    };
    fetchQuestions();
  }, [level]);

  if (loading) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><GraduationCap className="w-12 h-12 text-emerald-500" /></motion.div></div>;
  if (questions.length === 0) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center">Nenhum exercício encontrado.</div>;

  const currentQuestion = questions[currentQuestionIdx];

  const handleCheck = async () => {
    if (!selectedOption) return;
    const correct = selectedOption === currentQuestion.resposta;
    setIsCorrect(correct);
    setIsAnswered(true);
    setShowExplanation(true);

    const userRef = doc(db, 'users', profile.uid);
    const rankingRef = doc(db, 'ranking', profile.uid);

    if (!correct) {
      const newVidas = Math.max(0, vidas - 1);
      setVidas(newVidas);
      await updateDoc(userRef, { vidas: newVidas });
    } else {
      const newMoedas = moedas + 5;
      const newPontos = profile.pontos + 10;
      setMoedas(newMoedas);
      await updateDoc(userRef, { 
        moedas: newMoedas,
        pontos: newPontos
      });
      await updateDoc(rankingRef, { pontos: newPontos });
    }
  };

  const handleNext = async () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowExplanation(false);
    } else {
      // Level complete
      try {
        const progressRef = doc(db, 'users', profile.uid, 'progress', level.id);
        const progressDoc = await getDoc(progressRef);
        const isFirstTime = !progressDoc.exists() || !progressDoc.data()?.concluido;

        await setDoc(progressRef, { 
          levelId: level.id,
          courseId: level.courseId,
          concluido: true, 
          score: 100,
          data_conclusao: new Date().toISOString()
        });

        if (isFirstTime) {
          const userRef = doc(db, 'users', profile.uid);
          const rankingRef = doc(db, 'ranking', profile.uid);
          
          await updateDoc(userRef, { 
            medalhas: increment(1),
            pontos: increment(50) // Bônus por finalizar o nível
          });
          
          await updateDoc(rankingRef, { 
            medalhas: increment(1),
            pontos: increment(50)
          });
        }
      } catch (error) {
        console.error("Erro ao salvar progresso:", error);
      }
      onClose();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-white z-[100] flex flex-col"
    >
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col p-6">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <div className="flex-1 mx-8">
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIdx + 1) / questions.length) * 100}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-red-500 font-bold">
              <Heart className="w-6 h-6 fill-current" />
              <span>{vidas}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-8">
          <div className="space-y-4">
            <Badge variant="warning">{currentQuestion.tipo === 'theory' ? 'Teoria' : 'Prática'}</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-tight">
              {currentQuestion.enunciado}
            </h2>
            {currentQuestion.codigo && (
              <pre className="bg-slate-900 text-emerald-400 p-6 rounded-2xl font-mono text-sm overflow-x-auto shadow-inner">
                <code>{currentQuestion.codigo}</code>
              </pre>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.opcoes?.map((option) => (
              <button
                key={option}
                disabled={isAnswered}
                onClick={() => setSelectedOption(option)}
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all font-medium flex items-center justify-between group",
                  selectedOption === option 
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  isAnswered && option === currentQuestion.resposta && "border-emerald-500 bg-emerald-50 text-emerald-700",
                  isAnswered && selectedOption === option && option !== currentQuestion.resposta && "border-red-500 bg-red-50 text-red-700"
                )}
              >
                <span>{option}</span>
                {isAnswered && option === currentQuestion.resposta && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {isAnswered && selectedOption === option && option !== currentQuestion.resposta && <XCircle className="w-5 h-5 text-red-500" />}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 mt-8">
          {showExplanation && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-6 rounded-2xl mb-6 flex gap-4",
                isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                {isCorrect ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
              </div>
              <div>
                <p className="font-bold text-lg mb-1">{isCorrect ? 'Excelente!' : 'Ops, quase lá!'}</p>
                <p className="text-sm opacity-90">{currentQuestion.explicacao}</p>
              </div>
            </motion.div>
          )}

          <div className="flex justify-end">
            {!isAnswered ? (
              <Button 
                onClick={handleCheck} 
                disabled={!selectedOption}
                className="px-12 py-4 text-lg"
              >
                Verificar Resposta
              </Button>
            ) : (
              <Button 
                onClick={handleNext} 
                className="px-12 py-4 text-lg"
                variant={isCorrect ? 'primary' : 'secondary'}
              >
                {currentQuestionIdx === questions.length - 1 ? 'Finalizar Nível' : 'Próximo Exercício'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DashboardView({ profile }: { profile: UserProfile }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <Card className="md:col-span-2 space-y-6">
        <h3 className="text-xl font-bold">Minhas Medalhas</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
          {Array.from({ length: profile.medalhas }).map((_, i) => (
            <div key={i} className="aspect-square bg-yellow-50 rounded-2xl flex items-center justify-center border-2 border-yellow-200">
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
          ))}
          {Array.from({ length: Math.max(0, 12 - profile.medalhas) }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200 grayscale opacity-30">
              <Trophy className="w-8 h-8 text-slate-300" />
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-6">
        <Card className="bg-emerald-500 text-white border-none">
          <h3 className="font-bold mb-4">Estatísticas</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="opacity-80">Total de Pontos</span>
              <span className="font-bold text-xl">{profile.pontos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-80">Medalhas</span>
              <span className="font-bold text-xl">{profile.medalhas}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-80">Ofensiva Atual</span>
              <span className="font-bold text-xl">{profile.streak} dias</span>
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="font-bold mb-4">Sugestões de Ferramentas</h3>
          <div className="space-y-3">
            <ToolItem name="VS Code" desc="HTML, CSS, JavaScript" />
            <ToolItem name="JDK + NetBeans" desc="Para desenvolvimento Java." />
            <ToolItem name="XAMPP" desc="Banco de dados e PHP." />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ToolItem({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
      <p className="font-bold text-sm text-emerald-600">{name}</p>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
  );
}

function RankingView() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'ranking'), orderBy('pontos', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRanking(snapshot.docs.map(doc => doc.data() as RankingEntry));
    }, (err) => {
      console.error("Error fetching ranking:", err);
    });
    return unsubscribe;
  }, []);

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold">Ranking Global</h3>
        <Badge variant="warning">Top 50</Badge>
      </div>
      <div className="space-y-4">
        {ranking.map((user, i) => (
          <div key={user.userId} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
            <span className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold",
              i === 0 ? "bg-yellow-400 text-white" : i === 1 ? "bg-slate-300 text-white" : i === 2 ? "bg-orange-400 text-white" : "text-slate-400"
            )}>
              {i + 1}
            </span>
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.userId}`} alt="Avatar" />
            </div>
            <div className="flex-1">
              <p className="font-bold">{user.nome}</p>
              <div className="flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {user.streak} dias</span>
                <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-yellow-500" /> {user.medalhas} medalhas</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-600">{user.pontos} pts</p>
            </div>
          </div>
        ))}
        {ranking.length === 0 && <p className="text-center text-slate-400 py-8">Nenhum dado no ranking ainda.</p>}
      </div>
    </Card>
  );
}

function TeacherView({ profile }: { profile: UserProfile }) {
  const [activeSubTab, setActiveSubTab] = useState<'students' | 'content'>('students');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentProgress, setStudentProgress] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const isAuthorized = profile.role === 'teacher' || profile.role === 'admin';

  useEffect(() => {
    if (!isAuthorized) return;
    const q = query(collection(db, 'courses'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (err) => {
      console.error("Error fetching courses in TeacherView:", err);
    });
    return unsubscribe;
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => {
      console.error("Error fetching students in TeacherView:", err);
    });
    return unsubscribe;
  }, [isAuthorized]);

  if (!isAuthorized) return null;

  useEffect(() => {
    if (selectedStudent) {
      const q = collection(db, 'users', selectedStudent.uid, 'progress');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setStudentProgress(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return unsubscribe;
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedCourse) {
      const q = query(collection(db, 'courses', selectedCourse.id, 'levels'), orderBy('numero', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Level)));
      });
      return unsubscribe;
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedLevel && selectedCourse) {
      const q = collection(db, 'courses', selectedCourse.id, 'levels', selectedLevel.id, 'questions');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
      });
      return unsubscribe;
    }
  }, [selectedLevel, selectedCourse]);

  const handleDeleteQuestion = async (qId: string) => {
    if (!selectedCourse || !selectedLevel) return;
    if (confirm('Tem certeza que deseja excluir esta questão?')) {
      await updateDoc(doc(db, 'courses', selectedCourse.id, 'levels', selectedLevel.id, 'questions', qId), { deleted: true });
      // In a real app we might actually delete or use a flag. For now let's just delete.
      // But firestore rules might prevent delete if not careful.
      // Let's use deleteDoc if we have permissions.
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !selectedLevel || !editingQuestion) return;
    
    try {
      const qData = {
        ...editingQuestion,
        levelId: selectedLevel.id,
      };
      
      if (editingQuestion.id) {
        await updateDoc(doc(db, 'courses', selectedCourse.id, 'levels', selectedLevel.id, 'questions', editingQuestion.id), qData);
      } else {
        await addDoc(collection(db, 'courses', selectedCourse.id, 'levels', selectedLevel.id, 'questions'), qData);
      }
      setEditingQuestion(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAIGenerate = async () => {
    if (!selectedCourse || !selectedLevel) return;
    
    const difficulty = prompt("Qual dificuldade deseja gerar? (easy, medium, hard)", "easy") as DifficultyLevel;
    if (!['easy', 'medium', 'hard'].includes(difficulty)) return;

    setIsSeeding(true);
    setSeedStatus('Gerando questões via IA...');
    try {
      const generated = await generateQuestions(selectedCourse.nome, selectedLevel.numero, difficulty);
      const batch = writeBatch(db);
      
      generated.forEach(q => {
        const qRef = doc(collection(db, 'courses', selectedCourse.id, 'levels', selectedLevel.id, 'questions'));
        batch.set(qRef, { ...q, difficulty });
      });
      
      await batch.commit();
      alert(`${generated.length} questões geradas com sucesso!`);
    } catch (error) {
      console.error("Erro ao gerar questões:", error);
      alert("Erro ao gerar questões via IA.");
    } finally {
      setIsSeeding(false);
      setSeedStatus('');
    }
  };

  const filteredStudents = students.filter(s => 
    s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 pb-4">
        <button 
          onClick={() => setActiveSubTab('students')}
          className={cn('pb-2 px-4 font-bold transition-all border-b-2', activeSubTab === 'students' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400')}
        >
          Alunos
        </button>
        <button 
          onClick={() => setActiveSubTab('content')}
          className={cn('pb-2 px-4 font-bold transition-all border-b-2', activeSubTab === 'content' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400')}
        >
          Conteúdo
        </button>
      </div>

      {activeSubTab === 'students' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <div className="flex flex-col gap-4 mb-4">
              <h3 className="font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Lista de Alunos</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome ou e-mail..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              {filteredStudents.map(s => (
                <button 
                  key={s.uid}
                  onClick={() => setSelectedStudent(s)}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left', selectedStudent?.uid === s.uid ? 'bg-emerald-50 border-emerald-100 border' : 'hover:bg-slate-50 border border-transparent')}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.uid}`} alt="Avatar" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{s.nome}</p>
                    <p className="text-xs text-slate-500">{s.pontos} pts</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            {selectedStudent ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-200 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.uid}`} alt="Avatar" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedStudent.nome}</h3>
                    <p className="text-slate-500">{selectedStudent.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Pontos</p>
                    <p className="text-2xl font-bold text-emerald-600">{selectedStudent.pontos}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Medalhas</p>
                    <p className="text-2xl font-bold text-yellow-500">{selectedStudent.medalhas}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Ofensiva</p>
                    <p className="text-2xl font-bold text-orange-500">{selectedStudent.streak}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold mb-4">Níveis Concluídos</h4>
                  <div className="space-y-2">
                    {studentProgress.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className="font-medium">{p.levelId}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-400">{p.score}%</span>
                      </div>
                    ))}
                    {studentProgress.length === 0 && <p className="text-slate-400 text-sm italic">Nenhum progresso registrado ainda.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-20">
                <Search className="w-12 h-12 opacity-20" />
                <p>Selecione um aluno para ver o progresso detalhado.</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeSubTab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <h3 className="font-bold mb-4">Cursos</h3>
            <div className="space-y-2">
              {courses.map(c => (
                <button 
                  key={c.id}
                  onClick={() => { setSelectedCourse(c); setSelectedLevel(null); }}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left', selectedCourse?.id === c.id ? 'bg-emerald-50 border-emerald-100 border' : 'hover:bg-slate-50 border border-transparent')}
                >
                  <span className="font-bold text-sm">{c.nome}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-1">
            <h3 className="font-bold mb-4">Níveis</h3>
            {selectedCourse ? (
              <div className="space-y-2">
                {levels.map(l => (
                  <button 
                    key={l.id}
                    onClick={() => setSelectedLevel(l)}
                    className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left', selectedLevel?.id === l.id ? 'bg-emerald-50 border-emerald-100 border' : 'hover:bg-slate-50 border border-transparent')}
                  >
                    <span className="font-bold text-sm">Nível {l.numero}</span>
                  </button>
                ))}
                <Button variant="outline" className="w-full text-xs py-2 mt-4">
                  <Plus className="w-4 h-4" /> Novo Nível
                </Button>
              </div>
            ) : (
              <p className="text-slate-400 text-sm italic">Selecione um curso.</p>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Questões</h3>
              {selectedLevel && (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAIGenerate} 
                    variant="outline" 
                    disabled={isSeeding}
                    className="text-xs py-1.5 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Zap className="w-4 h-4" /> {isSeeding ? 'Gerando...' : 'Gerar via IA'}
                  </Button>
                  <Button onClick={() => setEditingQuestion({ tipo: 'theory', opcoes: ['', '', '', ''], difficulty: 'easy' })} className="text-xs py-1.5">
                    <Plus className="w-4 h-4" /> Nova Questão
                  </Button>
                </div>
              )}
            </div>
            
            {selectedLevel ? (
              <div className="space-y-4">
                {questions.map(q => (
                  <div key={q.id} className="p-4 border border-slate-100 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2">
                        <Badge className="text-[10px] uppercase">{q.tipo}</Badge>
                        <Badge variant={q.difficulty === 'hard' ? 'warning' : q.difficulty === 'medium' ? 'default' : 'success'} className="text-[10px] uppercase">
                          {q.difficulty || 'easy'}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingQuestion(q)} className="p-1 text-slate-400 hover:text-emerald-500"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteQuestion(q.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <p className="text-sm font-medium">{q.enunciado}</p>
                  </div>
                ))}
                {questions.length === 0 && <p className="text-slate-400 text-sm italic">Nenhuma questão neste nível.</p>}
              </div>
            ) : (
              <p className="text-slate-400 text-sm italic">Selecione um nível.</p>
            )}
          </Card>
        </div>
      )}

      {/* Question Editor Modal */}
      <AnimatePresence>
        {editingQuestion && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">{editingQuestion.id ? 'Editar Questão' : 'Nova Questão'}</h3>
                <button onClick={() => setEditingQuestion(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleSaveQuestion} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Tipo de Questão</label>
                    <select 
                      value={editingQuestion.tipo}
                      onChange={(e) => setEditingQuestion({...editingQuestion, tipo: e.target.value as any})}
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="theory">Teoria (Múltipla Escolha)</option>
                      <option value="practice">Prática</option>
                      <option value="code">Código</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Dificuldade</label>
                    <select 
                      value={editingQuestion.difficulty || 'easy'}
                      onChange={(e) => setEditingQuestion({...editingQuestion, difficulty: e.target.value as any})}
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="easy">Fácil</option>
                      <option value="medium">Médio</option>
                      <option value="hard">Difícil</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Enunciado</label>
                  <textarea 
                    required
                    value={editingQuestion.enunciado}
                    onChange={(e) => setEditingQuestion({...editingQuestion, enunciado: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                    placeholder="Digite a pergunta..."
                  />
                </div>

                {editingQuestion.tipo === 'theory' && (
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700">Opções de Resposta</label>
                    {editingQuestion.opcoes?.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                        <input 
                          type="text"
                          required
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...(editingQuestion.opcoes || [])];
                            newOpts[idx] = e.target.value;
                            setEditingQuestion({...editingQuestion, opcoes: newOpts});
                          }}
                          className="flex-1 p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder={`Opção ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Resposta Correta</label>
                  <input 
                    type="text"
                    required
                    value={editingQuestion.resposta}
                    onChange={(e) => setEditingQuestion({...editingQuestion, resposta: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="A resposta exata..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Explicação</label>
                  <textarea 
                    required
                    value={editingQuestion.explicacao}
                    onChange={(e) => setEditingQuestion({...editingQuestion, explicacao: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Por que esta é a resposta correta?"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditingQuestion(null)} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">Salvar Questão</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminView({ profile }: { profile: UserProfile }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState<Partial<Course>>({
    nome: '',
    description: '',
    icon: 'Code2',
    order: 1
  });

  const availableIcons = [
    { name: 'Code2', icon: Code2 },
    { name: 'Coffee', icon: Coffee },
    { name: 'Layout', icon: Layout },
    { name: 'Palette', icon: Palette },
    { name: 'Zap', icon: Zap },
    { name: 'Database', icon: Database },
    { name: 'Server', icon: Server },
    { name: 'Terminal', icon: Terminal },
    { name: 'Hash', icon: Hash },
    { name: 'Briefcase', icon: Briefcase }
  ];

  const isAuthorized = profile.role === 'admin';

  useEffect(() => {
    if (!isAuthorized) return;
    const qUsers = query(collection(db, 'users'), limit(100));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => {
      console.error("Error fetching users in AdminView:", err);
    });

    const qCourses = query(collection(db, 'courses'), orderBy('order', 'asc'));
    const unsubCourses = onSnapshot(qCourses, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching courses in AdminView:", err);
    });

    return () => {
      unsubUsers();
      unsubCourses();
    };
  }, [isAuthorized]);

  if (!isAuthorized) return null;

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    if (confirm(`Alterar papel do usuário para ${newRole}?`)) {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.nome || !newCourse.description) return;

    const courseId = newCourse.nome.toLowerCase().replace(/\s+/g, '-');
    const courseData = {
      ...newCourse,
      id: courseId,
      order: courses.length + 1
    };

    try {
      await setDoc(doc(db, 'courses', courseId), courseData);
      setIsAddingCourse(false);
      setNewCourse({ nome: '', description: '', icon: 'Code2', order: courses.length + 2 });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Usuários" value={users.length.toString()} icon={Users} color="blue" />
        <StatCard title="Professores" value={users.filter(u => u.role === 'teacher').length.toString()} icon={ShieldCheck} color="purple" />
        <StatCard title="Alunos" value={users.filter(u => u.role === 'student').length.toString()} icon={UserIcon} color="emerald" />
        <StatCard title="Cursos" value={courses.length.toString()} icon={BookOpen} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Gestão de Usuários</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar usuário..." 
                className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-sm">
                  <th className="pb-4 font-medium">Usuário</th>
                  <th className="pb-4 font-medium">E-mail</th>
                  <th className="pb-4 font-medium">Papel</th>
                  <th className="pb-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.uid} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} alt="Avatar" />
                        </div>
                        <span className="font-medium">{u.nome}</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-500 text-sm">{u.email}</td>
                    <td className="py-4">
                      <Badge variant={u.role === 'admin' ? 'warning' : u.role === 'teacher' ? 'success' : 'default'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        <select 
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.uid, e.target.value as UserRole)}
                          className="text-xs p-1 rounded border border-slate-200 outline-none"
                        >
                          <option value="student">Aluno</option>
                          <option value="teacher">Professor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Cursos</h3>
            <Button onClick={() => setIsAddingCourse(true)} className="text-xs py-1.5">
              <Plus className="w-4 h-4" /> Novo Curso
            </Button>
          </div>

          {isAddingCourse && (
            <form onSubmit={handleAddCourse} className="mb-6 p-4 bg-slate-50 rounded-2xl space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Nome do Curso</label>
                <input 
                  type="text" 
                  required
                  value={newCourse.nome}
                  onChange={(e) => setNewCourse({...newCourse, nome: e.target.value})}
                  className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                <textarea 
                  required
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                  className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Ícone</label>
                <div className="grid grid-cols-5 gap-2">
                  {availableIcons.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setNewCourse({...newCourse, icon: name})}
                      className={cn(
                        'p-2 rounded-lg border transition-all flex items-center justify-center',
                        newCourse.icon === name ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 py-2 text-sm">Salvar</Button>
                <Button type="button" variant="ghost" onClick={() => setIsAddingCourse(false)} className="flex-1 py-2 text-sm">Cancelar</Button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {courses.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-bold text-sm">{c.nome}</span>
                </div>
                <Badge className="text-[10px]">{c.order}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    orange: 'bg-orange-50 text-orange-500',
    purple: 'bg-purple-50 text-purple-500',
  };
  return (
    <Card className="flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', colors[color as keyof typeof colors])}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
