import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { generateWorkoutPlan, getFitnessAdvice, GeneratedWorkout } from './services/geminiService';
import { 
  Dumbbell, 
  Plus, 
  History, 
  LayoutDashboard, 
  User as UserIcon, 
  LogOut, 
  Flame, 
  Timer, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  Sparkles,
  Moon,
  Footprints,
  Heart,
  MessageSquare
} from 'lucide-react';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface UserProfile {
  uid: string;
  displayName: string;
  age: number;
  weight: number;
  height: number;
  fitnessLevel: string;
  goal: string;
  createdAt: any;
}

interface ActivityLog {
  id: string;
  uid: string;
  date: any;
  workoutTitle: string;
  duration: number;
  caloriesBurned: number;
  notes: string;
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'outline' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
      secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
      outline: 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
      ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-zinc-900/50 border border-white/5 rounded-2xl p-6', className)}>
    {children}
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'generate' | 'history' | 'profile'>('dashboard');
  
  // Dashboard State
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({ totalWorkouts: 0, totalMinutes: 0, totalCalories: 0 });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const logsQuery = query(
      collection(db, 'logs'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActivityLog[];
      setRecentLogs(logs);
      
      // Simple stat calculation from logs
      const totalMinutes = logs.reduce((acc, log) => acc + (log.duration || 0), 0);
      const totalCalories = logs.reduce((acc, log) => acc + (log.caloriesBurned || 0), 0);
      setStats({
        totalWorkouts: logs.length,
        totalMinutes,
        totalCalories
      });
    });

    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  if (!profile) {
    return <OnboardingView user={user} onComplete={setProfile} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans">
      {/* Sidebar / Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex justify-around items-center md:top-0 md:bottom-auto md:left-0 md:w-20 md:h-full md:flex-col md:justify-start md:gap-8 md:border-t-0 md:border-r z-50">
        <div className="hidden md:flex mb-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Dumbbell className="text-black w-6 h-6" />
          </div>
        </div>
        
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Home" />
        <NavButton active={activeTab === 'generate'} onClick={() => setActiveTab('generate')} icon={<Sparkles />} label="AI Plan" />
        <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History />} label="Logs" />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon />} label="Me" />
        
        <div className="md:mt-auto">
          <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pb-24 md:pb-8 md:pl-28 max-w-5xl mx-auto px-6 pt-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            {activeTab === 'dashboard' && `Welcome back, ${profile.displayName.split(' ')[0]}`}
            {activeTab === 'generate' && 'AI Workout Generator'}
            {activeTab === 'history' && 'Activity History'}
            {activeTab === 'profile' && 'Your Profile'}
          </h1>
          <p className="text-zinc-400 text-sm">
            {activeTab === 'dashboard' && format(new Date(), 'EEEE, MMMM do')}
            {activeTab === 'generate' && 'Personalized routines powered by Gemini'}
            {activeTab === 'history' && 'Track your progress over time'}
            {activeTab === 'profile' && 'Manage your fitness data'}
          </p>
        </header>

        {activeTab === 'dashboard' && <DashboardView stats={stats} logs={recentLogs} />}
        {activeTab === 'generate' && <GeneratorView profile={profile} />}
        {activeTab === 'history' && <HistoryView logs={recentLogs} />}
        {activeTab === 'profile' && <ProfileView profile={profile} onUpdate={setProfile} />}
      </main>
    </div>
  );
}

// --- Sub-Views ---

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-200",
        active ? "text-emerald-500" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-colors",
        active && "bg-emerald-500/10"
      )}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
      </div>
      <span className="text-[10px] uppercase tracking-widest font-bold md:hidden">{label}</span>
    </button>
  );
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/40 rotate-12">
        <Dumbbell className="w-10 h-10 text-black" />
      </div>
      <h1 className="text-5xl font-black tracking-tighter text-white mb-4 uppercase italic">Fitness AI</h1>
      <p className="text-zinc-400 max-w-xs mb-10 leading-relaxed">
        Your personal AI-powered fitness coach. Personalized plans, real-time tracking, and data-driven results.
      </p>
      <Button onClick={onLogin} className="w-full max-w-xs py-4 text-lg">
        Get Started with Google
      </Button>
    </div>
  );
}

function OnboardingView({ user, onComplete }: { user: User, onComplete: (p: UserProfile) => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    age: 25,
    weight: 70,
    height: 175,
    fitnessLevel: 'beginner',
    goal: 'Build muscle'
  });

  const handleSubmit = async () => {
    const profile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || 'User',
      ...formData,
      createdAt: Timestamp.now()
    };
    await setDoc(doc(db, 'users', user.uid), profile);
    onComplete(profile);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex gap-2 mb-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn("h-1 flex-1 rounded-full", s <= step ? "bg-emerald-500" : "bg-zinc-800")} />
            ))}
          </div>
          <h2 className="text-2xl font-bold text-white">Let's build your profile</h2>
          <p className="text-zinc-400 text-sm">This helps Gemini create better plans for you.</p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Age</label>
              <input 
                type="number" 
                value={formData.age} 
                onChange={e => setFormData({...formData, age: Number(e.target.value)})}
                className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Weight (kg)</label>
                <input 
                  type="number" 
                  value={formData.weight} 
                  onChange={e => setFormData({...formData, weight: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Height (cm)</label>
                <input 
                  type="number" 
                  value={formData.height} 
                  onChange={e => setFormData({...formData, height: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <Button onClick={() => setStep(2)} className="w-full mt-4">Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Fitness Level</label>
            {['beginner', 'intermediate', 'advanced'].map(level => (
              <button
                key={level}
                onClick={() => setFormData({...formData, fitnessLevel: level})}
                className={cn(
                  "w-full p-4 rounded-xl text-left border transition-all capitalize",
                  formData.fitnessLevel === level ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-zinc-800 border-transparent text-zinc-400"
                )}
              >
                {level}
              </button>
            ))}
            <div className="flex gap-4 mt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1">Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Main Goal</label>
            <textarea 
              value={formData.goal}
              onChange={e => setFormData({...formData, goal: e.target.value})}
              placeholder="e.g. Lose 5kg in 2 months, run a marathon..."
              className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 h-32 resize-none"
            />
            <div className="flex gap-4 mt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button onClick={handleSubmit} className="flex-1">Complete</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DashboardView({ stats, logs }: { stats: any, logs: ActivityLog[] }) {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<CheckCircle2 className="text-emerald-500" />} label="Workouts" value={stats.totalWorkouts} />
        <StatCard icon={<Timer className="text-blue-500" />} label="Minutes" value={stats.totalMinutes} />
        <StatCard icon={<Flame className="text-orange-500" />} label="Calories" value={stats.totalCalories} />
      </div>

      {/* AI Advice Section */}
      <AdviceSection />

      {/* Recent Activity */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Recent Activity</h3>
          <Button variant="ghost" className="text-xs uppercase tracking-widest">View All</Button>
        </div>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-zinc-500 text-sm">No activity recorded yet.</p>
            </Card>
          ) : (
            logs.map(log => (
              <div key={log.id} className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <Dumbbell className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{log.workoutTitle}</h4>
                    <p className="text-xs text-zinc-500">{format(log.date.toDate(), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-6">
                  <div className="hidden sm:block">
                    <p className="text-sm font-bold text-white">{log.duration}m</p>
                    <p className="text-[10px] uppercase text-zinc-500">Duration</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function AdviceSection() {
  const [data, setData] = useState({ sleep: 8, steps: 5000, heartRate: 70 });
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGetAdvice = async () => {
    setLoading(true);
    try {
      const res = await getFitnessAdvice(data);
      setAdvice(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-emerald-500/10">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-emerald-500" />
        <h3 className="text-lg font-bold text-white">Daily AI Insights</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <Moon className="w-3 h-3" /> Sleep (hrs)
          </label>
          <input 
            type="number" 
            value={data.sleep}
            onChange={e => setData({...data, sleep: Number(e.target.value)})}
            className="w-full bg-zinc-800 border-none rounded-xl px-4 py-2 text-white focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <Footprints className="w-3 h-3" /> Steps
          </label>
          <input 
            type="number" 
            value={data.steps}
            onChange={e => setData({...data, steps: Number(e.target.value)})}
            className="w-full bg-zinc-800 border-none rounded-xl px-4 py-2 text-white focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <Heart className="w-3 h-3" /> Heart Rate
          </label>
          <input 
            type="number" 
            value={data.heartRate}
            onChange={e => setData({...data, heartRate: Number(e.target.value)})}
            className="w-full bg-zinc-800 border-none rounded-xl px-4 py-2 text-white focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      <Button 
        onClick={handleGetAdvice} 
        disabled={loading}
        className="w-full mb-6 gap-2"
        variant="secondary"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
        Get Coach Advice
      </Button>

      {advice && (
        <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed">
            <Markdown>{advice}</Markdown>
          </div>
        </div>
      )}
    </Card>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="p-3 bg-zinc-800 rounded-xl">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">{label}</p>
      </div>
    </Card>
  );
}

function GeneratorView({ profile }: { profile: UserProfile }) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const plan = await generateWorkoutPlan(profile, prompt);
      setWorkout(plan);
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleLogWorkout = async () => {
    if (!workout) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'logs'), {
        uid: profile.uid,
        date: Timestamp.now(),
        workoutTitle: workout.title,
        duration: 45, // default
        caloriesBurned: 300, // default
        notes: 'Generated by AI'
      });
      alert('Workout logged successfully!');
      setWorkout(null);
      setPrompt('');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {!workout ? (
        <Card>
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">What are we doing today?</label>
            <textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Generate a high-intensity 30-minute home workout focusing on core and legs."
              className="w-full bg-zinc-800 border-none rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-emerald-500 h-40 resize-none text-lg leading-relaxed"
            />
          </div>
          <Button 
            onClick={handleGenerate} 
            disabled={generating || !prompt.trim()} 
            className="w-full py-4 text-lg gap-2"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {generating ? 'Gemini is thinking...' : 'Generate Plan'}
          </Button>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{workout.title}</h2>
                <p className="text-zinc-400 text-sm">{workout.description}</p>
              </div>
              <Button variant="outline" onClick={() => setWorkout(null)}>New Plan</Button>
            </div>
            
            <div className="space-y-4">
              {workout.exercises.map((ex, i) => (
                <div key={i} className="bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-emerald-400">{ex.name}</h4>
                    <span className="text-xs font-bold bg-zinc-700 px-2 py-1 rounded text-zinc-300">
                      {ex.sets} Sets × {ex.reps}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 italic">{ex.notes}</p>
                </div>
              ))}
            </div>

            <Button onClick={handleLogWorkout} disabled={saving} className="w-full mt-8 py-4 gap-2">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Mark as Completed
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

function HistoryView({ logs }: { logs: ActivityLog[] }) {
  return (
    <div className="space-y-4">
      {logs.map(log => (
        <Card key={log.id} className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
              <History className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <h4 className="font-bold text-white">{log.workoutTitle}</h4>
              <p className="text-xs text-zinc-500">{format(log.date.toDate(), 'PPPP')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-emerald-500">{log.caloriesBurned} kcal</p>
            <p className="text-[10px] uppercase text-zinc-500">{log.duration} mins</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ProfileView({ profile, onUpdate }: { profile: UserProfile, onUpdate: (p: UserProfile) => void }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', profile.uid), formData);
      onUpdate(formData);
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile', error);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Card className="space-y-6">
        <h3 className="text-xl font-bold text-white mb-4">Edit Profile</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Display Name</label>
            <input 
              type="text" 
              value={formData.displayName} 
              onChange={e => setFormData({...formData, displayName: e.target.value})}
              className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Age</label>
              <input 
                type="number" 
                value={formData.age} 
                onChange={e => setFormData({...formData, age: Number(e.target.value)})}
                className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Fitness Level</label>
              <select 
                value={formData.fitnessLevel}
                onChange={e => setFormData({...formData, fitnessLevel: e.target.value})}
                className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 appearance-none"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Weight (kg)</label>
              <input 
                type="number" 
                value={formData.weight} 
                onChange={e => setFormData({...formData, weight: Number(e.target.value)})}
                className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Height (cm)</label>
              <input 
                type="number" 
                value={formData.height} 
                onChange={e => setFormData({...formData, height: Number(e.target.value)})}
                className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Main Goal</label>
            <textarea 
              value={formData.goal}
              onChange={e => setFormData({...formData, goal: e.target.value})}
              className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 h-24 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => { setEditing(false); setFormData(profile); }}>
            Cancel
          </Button>
          <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div className="flex items-center gap-6 mb-8">
        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-emerald-500/20">
          <UserIcon className="w-10 h-10 text-zinc-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{profile.displayName}</h2>
          <p className="text-zinc-500 text-sm">Member since {format(profile.createdAt.toDate(), 'MMMM yyyy')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ProfileItem label="Age" value={profile.age} />
        <ProfileItem label="Level" value={profile.fitnessLevel} className="capitalize" />
        <ProfileItem label="Weight" value={`${profile.weight} kg`} />
        <ProfileItem label="Height" value={`${profile.height} cm`} />
      </div>

      <div className="pt-6 border-t border-white/5">
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Current Goal</label>
        <p className="text-zinc-300 leading-relaxed">{profile.goal}</p>
      </div>

      <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>
        Edit Profile
      </Button>
    </Card>
  );
}

function ProfileItem({ label, value, className }: { label: string, value: any, className?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{label}</label>
      <p className={cn("text-lg font-bold text-white", className)}>{value}</p>
    </div>
  );
}
