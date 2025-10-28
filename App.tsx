import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { UserData, GeneratedPlan, Exercise, WorkoutLog, User } from './types';
import { generateWorkoutPlan } from './services/geminiService';
import * as db from './services/dbService';
import WorkoutForm from './components/WorkoutForm';
import WorkoutPlanDisplay from './components/WorkoutPlanDisplay';
import { UserIcon, WeightIcon, HeightIcon, UsersIcon, BarChartIcon, TargetIcon, DumbbellIcon, XCircleIcon } from './components/Icons';
import { calculateBMI } from './utils/calculateBmi';
import Splitter from './components/Splitter';
import ProfileDropdown from './components/ProfileDropdown';
import LoginDetailsView from './components/LoginDetailsView';
import ThemeSwitcher from './components/ThemeSwitcher';

type AppState = 'FORM' | 'PLAN_VIEW';
export type ActiveView = 'PLAN' | 'DIET' | 'PROGRESS' | 'PROFILE' | 'EDIT_PLAN';

interface AppProps {
  currentUser: User;
  onLogout: () => void;
  onChangePassword: (username: string, oldPass: string, newPass: string) => Promise<void>;
}

const App: React.FC<AppProps> = ({ currentUser, onLogout, onChangePassword }) => {
  const [appState, setAppState] = useState<AppState>('FORM');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<GeneratedPlan | null>(null);
  const [editingPlan, setEditingPlan] = useState<GeneratedPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutLog[]>([]);
  const [showNewWeekMessage, setShowNewWeekMessage] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [activeView, setActiveView] = useState<ActiveView>('PLAN');
  const [isWeekCompleted, setIsWeekCompleted] = useState(false);

  const [leftPanelWidth, setLeftPanelWidth] = useState(33.33); // Corresponds to lg:col-span-4
  const isResizing = useRef(false);
  const mainContainerRef = useRef<HTMLElement>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;
      try {
        const profile = await db.getProfile(currentUser.username);
        const history = await db.getWorkoutLogs(currentUser.username);

        if (profile) {
          setUserData(profile.userData);
          if (profile.workoutPlan) {
            setWorkoutPlan(profile.workoutPlan);
            setAppState('PLAN_VIEW');
          } else {
            setAppState('FORM');
          }
        } else {
          setUserData({
            name: '',
            weight: '', height: '', freeDays: [], gender: '',
            fitnessLevel: '', goal: '', equipment: '', maxSessionTime: '',
          });
        }
        setWorkoutHistory(history);
      } catch (e) {
        console.error("Failed to load data from database", e);
        setError("Could not load your data. Please try refreshing the page.");
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !userData || !isDataLoaded) return;
    
    const profileToSave: db.StoredProfile = {
        username: currentUser.username,
        userData,
        workoutPlan,
    };
    db.saveProfile(profileToSave).catch(e => console.error("Failed to save profile", e));
  }, [userData, workoutPlan, currentUser, isDataLoaded]);

  useEffect(() => {
    if (workoutPlan?.plan && workoutPlan?.completedDays) {
        const isCompleted = workoutPlan.plan.length > 0 && workoutPlan.plan.length === workoutPlan.completedDays.length;
        setIsWeekCompleted(isCompleted);
        if (isCompleted) {
            setActiveView('PLAN'); // Switch to plan view to show completion screen
        }
    } else {
        setIsWeekCompleted(false);
    }
  }, [workoutPlan]);


  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isResizing.current = true;
    e.preventDefault();
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    isResizing.current = false;
  }, []);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !mainContainerRef.current) return;

    const container = mainContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / container.offsetWidth) * 100;
    const minWidth = 25;
    const maxWidth = 50;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setLeftPanelWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    const handleUp = () => handleResizeMouseUp();
    const handleMove = (e: MouseEvent) => handleResizeMouseMove(e);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);


  const handleGeneratePlan = useCallback(async (data: UserData) => {
    if (data.freeDays.length === 0) {
      setError('Please select at least one free day for your workout.');
      return;
    }
    
    setShowNewWeekMessage(false);
    setIsLoading(true);
    setError(null);
    setWorkoutPlan(null);
    setEditingPlan(null);
    setActiveView('PLAN');
    setSelectedDayIndex(0);

    try {
      const bmi = calculateBMI(data.weight, data.height);
      const plan = await generateWorkoutPlan(data, bmi);
      setWorkoutPlan(plan);
      setAppState('PLAN_VIEW');
    } catch (err) {
      console.error(err);
      setError('Failed to generate workout plan. Please check your inputs or try again later.');
      setAppState('FORM');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const handleUpdateUserData = (newUserData: UserData) => {
    setUserData(newUserData);
  };

  const handleRegenerateWithNewData = useCallback(async (newUserData: UserData) => {
    setUserData(newUserData);
    await handleGeneratePlan(newUserData);
  }, [handleGeneratePlan]);

  const handleStartEdit = () => {
    if (workoutPlan) {
      setEditingPlan(JSON.parse(JSON.stringify(workoutPlan)));
    }
  };
  
  const handleSaveChanges = () => {
    setWorkoutPlan(editingPlan);
    setEditingPlan(null);
  };
  
  const handleDiscardChanges = () => {
    setEditingPlan(null);
  };

  const handleReset = useCallback(() => {
    setAppState('FORM');
    setWorkoutPlan(null);
    setEditingPlan(null);
    setError(null);
    setShowNewWeekMessage(true);
      if (userData) {
        setUserData(prev => ({
            ...prev!,
            weight: '', height: '', freeDays: [], gender: '',
            fitnessLevel: '', goal: '', equipment: '', maxSessionTime: '',
        }));
      }
  }, [userData]);
  
  const handlePlanUpdate = (path: (string | number)[], value: any) => {
    setEditingPlan(prev => {
      if (!prev) return null;
      const newPlan = JSON.parse(JSON.stringify(prev));
      let current: any = newPlan;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newPlan;
    });
  };

  const handleDeleteExercise = (dayIndex: number, groupIndex: number, exerciseIndex: number) => {
    setEditingPlan(prev => {
      if (!prev) return null;
      const newPlan = JSON.parse(JSON.stringify(prev));
      newPlan.plan[dayIndex].muscleGroups[groupIndex].exercises.splice(exerciseIndex, 1);
      return newPlan;
    });
  };

  const handleAddExercise = (dayIndex: number, groupIndex: number) => {
    setEditingPlan(prev => {
      if (!prev) return null;
      const newPlan = JSON.parse(JSON.stringify(prev));
      const newExercise: Exercise = {
        name: 'New Exercise',
        sets: '3',
        reps: '10',
        description: 'Enter a short description of the exercise.',
        targetMuscles: ['Primary Muscle', 'Secondary Muscle'],
      };
      newPlan.plan[dayIndex].muscleGroups[groupIndex].exercises.push(newExercise);
      return newPlan;
    });
  };

  const handleLogWorkout = async (dayIndex: number): Promise<boolean> => {
    if (!workoutPlan) return false;
    const planDay = workoutPlan.plan[dayIndex];
    const newLog: WorkoutLog = {
      date: new Date().toISOString(),
      dayName: planDay.day,
      focus: planDay.focus,
      caloriesBurned: planDay.caloriesBurned,
    };

    // Determine if the week will be complete after this workout
    const currentCompleted = new Set(workoutPlan.completedDays || []);
    const isAlreadyCompleted = currentCompleted.has(planDay.day);
    const isNowComplete = !isAlreadyCompleted && (currentCompleted.size + 1 === workoutPlan.plan.length);

    try {
        await db.addWorkoutLog({ ...newLog, username: currentUser.username });
        setWorkoutHistory(prev => [newLog, ...prev]);
        setWorkoutPlan(prevPlan => {
            if (!prevPlan) return null;
            const completed = new Set(prevPlan.completedDays || []);
            completed.add(planDay.day);
            return { ...prevPlan, completedDays: Array.from(completed) };
        });
        // Move to the next day automatically if not the last day
        if (dayIndex < workoutPlan.plan.length - 1) {
          setSelectedDayIndex(dayIndex + 1);
        }
        return isNowComplete;

    } catch (e) {
        console.error("Failed to log workout", e);
        setError("Could not save your workout log.");
        return false;
    }
  };
  
  const handleOpenAccountModal = () => setIsAccountModalOpen(true);
  const handleCloseAccountModal = () => setIsAccountModalOpen(false);


  if (!isDataLoaded || !userData) {
    return (
        <div className="min-h-screen flex items-center justify-center">
             <svg className="animate-spin h-10 w-10 text-slate-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
        </div>
    );
  }

  const handleViewChange = (view: ActiveView) => {
    if (view === 'EDIT_PLAN') {
      handleStartEdit();
    } else if (activeView === 'EDIT_PLAN' && editingPlan) {
      handleDiscardChanges();
    }
    setActiveView(view);
  };
  
  const PlanSummarySidebar: React.FC = () => {
    const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
        <div className="flex items-start text-sm">
            <div className="flex-shrink-0 w-5 h-5 text-indigo-500 dark:text-indigo-400 mr-3 mt-0.5">{icon}</div>
            <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{label}</p>
                <p className="text-slate-600 dark:text-slate-400">{value || 'Not set'}</p>
            </div>
        </div>
    );

    return (
      <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 h-full flex flex-col">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 px-2">Current Plan For</h3>
          
          <div className="flex-grow overflow-y-auto pr-1 -mr-1 space-y-4 p-2">
            <InfoItem icon={<UserIcon />} label="Name" value={userData.name} />
            <InfoItem icon={<WeightIcon />} label="Weight" value={userData.weight} />
            <InfoItem icon={<HeightIcon />} label="Height" value={userData.height} />
            <InfoItem icon={<UsersIcon />} label="Gender" value={userData.gender} />
            <InfoItem icon={<BarChartIcon />} label="Experience Level" value={userData.fitnessLevel} />
            <InfoItem icon={<TargetIcon />} label="Primary Goal" value={userData.goal} />
            <InfoItem icon={<DumbbellIcon />} label="Available Equipment" value={userData.equipment} />
          </div>

          <button
            onClick={() => handleReset()}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Generate New Plan
          </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10 relative">
          <div className="flex justify-center items-center gap-4">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAABxElEQVR4nO3bv0vbcRjH8c/Bi4OF4Cg4CIp/gUPbpaTgX3AQhK7iVTu4Oggu4qCg4iC4CErBwaGLi5NDB0cXp8SCIN7lM491Lw/5nvM8hM/7PT8EcLgAEREREREREZESAs6AAVqjH/gPzCg1yQ82kZbqL9IZuG20s5g2Y9f7D8AVsAVcAXv47zHz3cBl8AicA5XQxP9lYBX4Afwh5wG4IARcBS7x3w+Ay+A5cAFUQPc7AlwPfhIXAHzBHiAB3jFfE2DBAXADfBn/OQ2s452LAf/BFfCR+EwDq8C7Fgz4N7wH9onPMrAJvGtBADxCT5AOfGS+VsAWC8AacJj5igFbLAPfAY+ZLxuwxgLwh31MvmyADeA/8JT5cgFrLAA3A3xkvnbABgPAbYCTzNcOWGAZ2AV8Z75mwFoLwK3AM+brBGywAIwCjpmvHbDCAvAecJz5+gEbLAEHwGvmawfssAC8ATwzXzvghQXgLfCa+doBCywDx8A75msHbLAAnANvm68dsMJC8AZ403ztgB0WgGvga+dtB/xZLPwCbgKfOaAfERERERERkRj5A+Q1n4M6gqXSAAAAAElFTSuQmCC" alt="FitPlan Logo" className="w-10 h-10 animate-pulse" />
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600">
              FitPlan
            </h1>
          </div>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Forge your ideal physique. Your personal AI coach crafts the perfect workout and diet plan based on your unique goals and stats.
          </p>
          <div className="absolute top-0 right-0 flex items-center gap-2">
            <ThemeSwitcher />
            <ProfileDropdown 
                username={currentUser.username}
                onLogout={onLogout}
                onManageAccount={handleOpenAccountModal}
            />
          </div>
        </header>

        <main ref={mainContainerRef} className="flex flex-col lg:flex-row">
          <div 
            style={{ '--left-panel-width': `${leftPanelWidth}%` } as React.CSSProperties} 
            className="w-full flex-shrink-0 lg:w-[var(--left-panel-width)]"
          >
            {appState === 'FORM' ? (
              <WorkoutForm
                userData={userData}
                setUserData={setUserData}
                onGeneratePlan={() => handleGeneratePlan(userData)}
                isLoading={isLoading}
                showNewWeekMessage={showNewWeekMessage}
              />
            ) : (
              <PlanSummarySidebar />
            )}
          </div>
          <Splitter onMouseDown={handleResizeMouseDown} />
          <div className={`flex-grow min-w-0 ${appState === 'FORM' ? 'hidden lg:block' : ''}`}>
            <WorkoutPlanDisplay
              activeView={activeView}
              onViewChange={handleViewChange}
              selectedDayIndex={selectedDayIndex}
              onSelectDay={setSelectedDayIndex}
              plan={workoutPlan}
              editingPlan={editingPlan}
              isLoading={isLoading}
              error={error}
              userData={userData}
              workoutHistory={workoutHistory}
              isWeekCompleted={isWeekCompleted}
              onLogWorkout={handleLogWorkout}
              onSaveChanges={handleSaveChanges}
              onDiscardChanges={handleDiscardChanges}
              onPlanUpdate={handlePlanUpdate}
              onDeleteExercise={handleDeleteExercise}
              onAddExercise={handleAddExercise}
              onUpdateUserData={handleUpdateUserData}
              onRegeneratePlan={handleRegenerateWithNewData}
              onReset={handleReset}
            />
          </div>
        </main>
      </div>
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-slate-300/60 dark:bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
            <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
                 <button 
                    onClick={handleCloseAccountModal}
                    className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors z-10"
                    aria-label="Close"
                 >
                    <XCircleIcon className="w-6 h-6"/>
                 </button>
                 <LoginDetailsView
                    currentUser={currentUser}
                    onChangePassword={onChangePassword}
                 />
            </div>
        </div>
      )}
    </div>
  );
};

export default App;