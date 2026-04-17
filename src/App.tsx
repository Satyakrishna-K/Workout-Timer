/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Timer as TimerIcon, 
  Dumbbell, 
  Coffee,
  CheckCircle2,
  Volume2,
  VolumeX,
  Plus,
  Flame,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/TimePicker';
import { ScrollPicker } from '@/components/ScrollPicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';

type TimerState = 'idle' | 'warmup' | 'work' | 'rest' | 'paused' | 'finished';

const WARMUP_DURATION = 15;

const COLORS = {
  WARMUP: '#00D1FF',
  WORK: '#FF3131',
  REST: '#00FF94',
  FINISHED: '#FFD700'
};

interface Preset {
  id: string;
  name: string;
  work: number;
  rest: number;
  rounds: number;
}

const DEFAULT_PRESETS: Preset[] = [];

export default function App() {
  // Settings
  const [workDuration, setWorkDuration] = useState(30);
  const [restDuration, setRestDuration] = useState(10);
  const [totalRounds, setTotalRounds] = useState(8);
  const [isMuted, setIsMuted] = useState(false);
  const [volume] = useState(0.8);

  // Presets
  const [presets, setPresets] = useState<Preset[]>(() => {
    const saved = localStorage.getItem('timer-presets');
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    localStorage.setItem('timer-presets', JSON.stringify(presets));
  }, [presets]);

  // Timer State
  const [state, setState] = useState<TimerState>('idle');
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(workDuration);
  const [showSettings, setShowSettings] = useState(true);
  const [expandedSetting, setExpandedSetting] = useState<'work' | 'rest' | 'rounds' | null>(null);
  const [lastActiveState, setLastActiveState] = useState<'work' | 'rest' | 'warmup'>('work');
  const [isFlashing, setIsFlashing] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return (
      <div className="flex gap-1 items-baseline">
        <span>{m.toString().padStart(2, '0')}</span><span className="text-[10px] opacity-50 font-sans tracking-normal font-bold">m</span>
        <span>{s.toString().padStart(2, '0')}</span><span className="text-[10px] opacity-50 font-sans tracking-normal font-bold">s</span>
      </div>
    );
  };

  // Refs for timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBell = useCallback(() => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const frequencies = [800, 1600, 2400]; // Higher frequencies for that sharp "Ding"
      
      frequencies.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = index === 0 ? 'triangle' : 'sine'; 
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          
          // Multiply by user volume to maintain slider control
          const maxGain = 0.5 * volume;
          gain.gain.linearRampToValueAtTime(maxGain, ctx.currentTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.01 * volume, ctx.currentTime + 1.2); // Sharp decay
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start();
          osc.stop(ctx.currentTime + 1.2);
      });
    } catch (e) {
      console.error("Audio error", e);
    }
  }, [isMuted, volume]);

  // Coach Voice Generator
  const coachSpeak = useCallback((text: string) => {
    if (isMuted) return;
    
    // Cancel any ongoing speech to prioritize the immediate command
    window.speechSynthesis.cancel();
    
    const msg = new SpeechSynthesisUtterance(text);
    msg.pitch = 0.9;
    msg.rate = 1.1; 
    msg.volume = volume;

    window.speechSynthesis.speak(msg);
  }, [isMuted, volume]);

  // Load voices proactively on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }
  }, []);

  // 1. Timer Interval Effect
  useEffect(() => {
    if (state === 'idle' || state === 'paused' || state === 'finished') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  // 2. State Transition Effect
  useEffect(() => {
    if (timeLeft === 0 && state !== 'idle' && state !== 'paused' && state !== 'finished') {
      const triggerFlash = () => {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 400);
      };

      if (state === 'warmup') {
        setState('work');
        setTimeLeft(workDuration);
        triggerFlash();
        if (currentRound > 1) { // Per logic, rounds 2+ start with bell. Wait, let's just ring it anyway unless prototype specifically conditionally branches
            playBell();
        } else {
            playBell(); // Original logic always had it play on Start 
        }
        coachSpeak("Work! Stick and move!");
      } else if (state === 'work') {
        if (currentRound < totalRounds) {
          setState('rest');
          setTimeLeft(restDuration);
          setCurrentRound((prev) => prev + 1);
          playBell();
          coachSpeak("Sit down, breathe. You won that round.");
        } else {
          setState('finished');
          playBell();
          setTimeout(playBell, 400);
          setTimeout(playBell, 800);
          coachSpeak("That's it! It's over! You're the champ!");
        }
      } else if (state === 'rest') {
        setState('work');
        setTimeLeft(workDuration);
        triggerFlash();
        playBell();
        coachSpeak("Work! Stick and move!");
      }
    }
  }, [timeLeft, state, workDuration, restDuration, currentRound, totalRounds, coachSpeak, playBell]);

  // 3. Coach Voice Cues
  useEffect(() => {
    if (state === 'idle' || state === 'paused' || state === 'finished') return;

    if (state === 'warmup') {
      if (timeLeft === 8) coachSpeak("Showtime's coming. Hands up, chin down.");
      else if (timeLeft === 3) coachSpeak("3");
      else if (timeLeft === 2) coachSpeak("2");
      else if (timeLeft === 1) {
        coachSpeak("1");
        setTimeout(playBell, 600); // Trigger the "Clang"
      }
    } 
    else if (state === 'work') {
      if (workDuration > 10 && timeLeft === Math.floor(workDuration / 2)) {
        coachSpeak("Halfway home! Don't you quit!");
      }
      else if (timeLeft === 30) coachSpeak("30 seconds! Champions are made in the dark!");
      else if (timeLeft === 10) coachSpeak("10 seconds of fury!");
      else if (timeLeft <= 3 && timeLeft > 0) coachSpeak(timeLeft.toString());
    } 
    else if (state === 'rest') {
      if (restDuration > 10 && timeLeft === Math.floor(restDuration / 2)) {
        coachSpeak("Stay hydrated. Control your heart rate.");
      }
      else if (timeLeft === 10) coachSpeak("Back on your stools. Get ready.");
      else if (timeLeft === 3) coachSpeak("3");
      else if (timeLeft === 2) coachSpeak("2");
      else if (timeLeft === 1) coachSpeak("BOX!");
    }
  }, [timeLeft, state, workDuration, restDuration, coachSpeak, playBell]);

  const startTimer = () => {
    if (state === 'idle' || state === 'finished') {
      setCurrentRound(1);
      setTimeLeft(WARMUP_DURATION);
      setState('warmup');
      setShowSettings(false);
      coachSpeak("Let's go Champ!");
    }
  };

  const handleTogglePause = () => {
    if (state === 'work' || state === 'rest' || state === 'warmup') {
      setLastActiveState(state);
      setState('paused');
    } else if (state === 'paused') {
      setState(lastActiveState);
    }
  };

  const handleReset = () => {
    setState('idle');
    setCurrentRound(1);
    setTimeLeft(workDuration);
    setShowSettings(true);
  };

  return (
    <div className="min-h-[100dvh] bg-bg-dark flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-accent-neon/30 relative pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)] overflow-y-auto">
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-0 bg-accent-neon pointer-events-none z-50"
          />
        )}
      </AnimatePresence>
      <div className="w-full max-w-[400px] min-h-[600px] sm:min-h-[700px] bg-card-bg rounded-[40px] border border-border-color shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col relative p-6 sm:p-8 z-10 my-auto">
        
        {/* Header */}
        <header className="text-center mb-6 mt-2">
          <h1 
            className="text-[2rem] text-white ml-[2px]"
            style={{ fontFamily: 'Magneto, "Brush Script MT", cursive', letterSpacing: '1px' }}
          >
            110 slice
          </h1>
          <AnimatePresence mode="wait">
            {!showSettings && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={cn(
                  "inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                  state === 'warmup' ? "bg-[#00D1FF]/10 border-[#00D1FF] text-[#00D1FF] shadow-[0_0_15px_rgba(0,209,255,0.2)]" :
                  state === 'work' ? "bg-[#FF3131]/10 border-[#FF3131] text-[#FF3131] shadow-[0_0_15px_rgba(255,49,49,0.2)]" : 
                  state === 'rest' ? "bg-[#00FF94]/10 border-[#00FF94] text-[#00FF94] shadow-[0_0_15px_rgba(0,255,148,0.2)]" :
                  state === 'paused' ? "bg-text-dim/10 border-text-dim text-text-dim" :
                  "bg-indigo-500/10 border-indigo-500 text-indigo-500"
                )}
              >
                {state === 'warmup' ? 'Warmup' : state === 'work' ? 'Work Phase' : state === 'rest' ? 'Rest Phase' : state === 'paused' ? 'Paused' : 'Completed'}
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col"
            >
              {/* Presets Quick Select */}
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar mb-4 pb-2 -mx-2 px-2">
                {presets.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center rounded-full bg-white/[0.05] border border-border-color hover:bg-white/[0.1] transition-all overflow-hidden shrink-0"
                  >
                    <button
                      onClick={() => {
                        setWorkDuration(p.work);
                        setRestDuration(p.rest);
                        setTotalRounds(p.rounds);
                        if (state === 'idle') {
                          setTimeLeft(p.work);
                        }
                      }}
                      className="whitespace-nowrap pl-4 pr-3 py-2 text-sm font-bold text-text-main"
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPresets(presets.filter(preset => preset.id !== p.id));
                      }}
                      className="pr-3 pl-1 py-3 text-text-dim hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="whitespace-nowrap px-4 py-2 rounded-full bg-accent-neon/[0.1] text-accent-neon border border-accent-neon/[0.2] text-sm font-bold flex items-center gap-1 hover:bg-accent-neon/[0.15] transition-all"
                >
                  <Plus className="w-4 h-4" /> Save
                </button>
              </div>

              {/* Settings Form */}
              <div className="grid grid-cols-1 gap-4 sm:gap-5 mb-6 sm:mb-8 flex-1">
                {/* Work Setting */}
                <div 
                  className={cn(
                    "bg-white/[0.03] border border-border-color rounded-3xl flex flex-col overflow-hidden transition-all duration-300 cursor-pointer hover:bg-white/[0.05]",
                    expandedSetting === 'work' ? "p-5 sm:p-6" : "p-5 sm:p-6"
                  )}
                  onClick={() => setExpandedSetting(expandedSetting === 'work' ? null : 'work')}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="text-sm sm:text-base font-bold text-white uppercase tracking-widest">Work Duration</div>
                    {expandedSetting !== 'work' && (
                      <div className="text-2xl font-mono font-bold text-accent-neon">{formatTime(workDuration)}</div>
                    )}
                  </div>
                  <AnimatePresence>
                    {expandedSetting === 'work' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="w-full overflow-hidden"
                      >
                        <div className="pt-4">
                          <TimePicker 
                            value={workDuration} 
                            onChange={(v) => {
                              setWorkDuration(v);
                              if (state === 'idle') setTimeLeft(v);
                            }}
                            className="w-full text-accent-neon"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Rest Setting */}
                <div 
                  className={cn(
                    "bg-white/[0.03] border border-border-color rounded-3xl flex flex-col overflow-hidden transition-all duration-300 cursor-pointer hover:bg-white/[0.05]",
                    expandedSetting === 'rest' ? "p-5 sm:p-6" : "p-5 sm:p-6"
                  )}
                  onClick={() => setExpandedSetting(expandedSetting === 'rest' ? null : 'rest')}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="text-sm sm:text-base font-bold text-white uppercase tracking-widest">Rest Duration</div>
                    {expandedSetting !== 'rest' && (
                      <div className="text-2xl font-mono font-bold text-accent-warn">{formatTime(restDuration)}</div>
                    )}
                  </div>
                  <AnimatePresence>
                    {expandedSetting === 'rest' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="w-full overflow-hidden"
                      >
                        <div className="pt-4">
                          <TimePicker 
                            value={restDuration} 
                            onChange={(v) => setRestDuration(v)}
                            className="w-full text-accent-warn"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Rounds Setting */}
                <div 
                  className={cn(
                    "bg-white/[0.03] border border-border-color rounded-3xl flex flex-col overflow-hidden transition-all duration-300 cursor-pointer hover:bg-white/[0.05]",
                    expandedSetting === 'rounds' ? "p-5 sm:p-6" : "p-5 sm:p-6"
                  )}
                  onClick={() => setExpandedSetting(expandedSetting === 'rounds' ? null : 'rounds')}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="text-sm sm:text-base font-bold text-white uppercase tracking-widest">Rounds</div>
                    {expandedSetting !== 'rounds' && (
                      <div className="text-2xl font-mono font-bold text-indigo-400">{totalRounds.toString().padStart(2, '0')}</div>
                    )}
                  </div>
                  <AnimatePresence>
                    {expandedSetting === 'rounds' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="w-full overflow-hidden"
                      >
                        <div className="pt-4">
                          <ScrollPicker 
                            options={Array.from({ length: 50 }, (_, i) => i + 1)}
                            value={totalRounds} 
                            onChange={(v) => setTotalRounds(v)}
                            className="w-full text-indigo-400"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <Button 
                onClick={startTimer}
                className="mt-auto w-full h-20 rounded-2xl bg-[#FFB800] text-bg-dark hover:bg-[#FFB800]/90 font-bold text-lg uppercase tracking-widest shadow-[0_10px_20px_rgba(255,184,0,0.2)] transition-all active:scale-95"
              >
                <Play className="w-6 h-6 mr-2 fill-current" />
                Start Workout
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="timer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex-1 flex flex-col items-center"
            >
              {/* Timer Section */}
              <div className={cn(
                "flex-1 flex flex-col items-center justify-center w-full transition-opacity duration-300",
                state === 'paused' ? "opacity-30" : "opacity-100"
              )}>
                <motion.div 
                  animate={{ scale: isFlashing ? [1, 1.1, 1] : 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="relative w-[320px] h-[320px] flex items-center justify-center"
                >
                  {/* Progress Ring with Glow */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
                    {/* Background Ring */}
                    <circle
                      cx="128"
                      cy="128"
                      r="124"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-border-color"
                    />
                    {/* Progress Ring */}
                    <motion.circle
                      cx="128"
                      cy="128"
                      r="124"
                      fill="none"
                      stroke={
                        state === 'warmup' ? COLORS.WARMUP :
                        state === 'work' ? COLORS.WORK : 
                        state === 'rest' ? COLORS.REST : 
                        COLORS.FINISHED
                      }
                      strokeWidth="4"
                      strokeLinecap="round"
                      initial={{ pathLength: 1 }}
                      animate={{ pathLength: timeLeft / (state === 'work' ? workDuration : state === 'rest' ? restDuration : WARMUP_DURATION) }}
                      transition={{ duration: 1, ease: "linear" }}
                      style={{
                        filter: `drop-shadow(0 0 8px ${state === 'warmup' ? COLORS.WARMUP : state === 'work' ? COLORS.WORK : state === 'rest' ? COLORS.REST : COLORS.FINISHED})`
                      }}
                    />
                  </svg>
                  <div className="flex flex-col items-center justify-center">
                    <motion.span 
                      key={timeLeft}
                      initial={{ scale: 0.9, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-[85px] font-mono italic tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] transition-colors duration-300"
                      style={{
                        color: state === 'warmup' ? COLORS.WARMUP : state === 'work' ? COLORS.WORK : state === 'rest' ? COLORS.REST : COLORS.FINISHED,
                        textShadow: `0 0 20px ${state === 'warmup' ? COLORS.WARMUP : state === 'work' ? COLORS.WORK : state === 'rest' ? COLORS.REST : COLORS.FINISHED}80`
                      }}
                    >
                      {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </motion.span>
                  </div>
                </motion.div>

                <div className="mt-6 flex flex-col items-center justify-center">
                  {state === 'warmup' || (state === 'paused' && lastActiveState === 'warmup') ? (
                    <span className="text-[#00D1FF] font-bold uppercase tracking-widest text-lg md:text-xl md:mb-5">PREPARE</span>
                  ) : state === 'finished' ? (
                    <span className="text-[#FFD700] font-bold uppercase tracking-widest text-lg md:text-xl drop-shadow-md md:mb-5">CHAMPION</span>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span 
                        className="font-bold uppercase tracking-widest text-2xl md:text-3xl mb-3 drop-shadow-md"
                        style={{
                          color: state === 'work' || (state === 'paused' && lastActiveState === 'work') ? COLORS.WORK : COLORS.REST
                        }}
                      >
                        {state === 'work' || (state === 'paused' && lastActiveState === 'work') ? `ROUND ${currentRound}` : 'REST'}
                      </span>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-text-dim/50 uppercase tracking-widest text-xs font-bold">Total</span>
                        <div className="text-xl text-text-dim flex items-baseline gap-1 font-mono font-bold">
                          <span className="text-text-main opacity-80">{totalRounds < 10 ? `0${totalRounds}` : totalRounds}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <footer className="w-full flex gap-4 mt-auto">
                <Button 
                  onClick={handleReset}
                  className="flex-1 h-20 rounded-2xl bg-white/[0.05] border border-border-color text-text-main hover:bg-white/[0.1] font-bold text-lg uppercase tracking-widest"
                >
                  Reset
                </Button>
                {state !== 'finished' ? (
                  <Button 
                    onClick={handleTogglePause}
                    className="flex-1 h-20 rounded-2xl bg-[#00FF94] text-bg-dark hover:bg-[#00FF94]/90 font-bold text-lg uppercase tracking-widest shadow-[0_10px_20px_rgba(0,255,148,0.2)]"
                  >
                    {state === 'paused' ? 'Resume' : 'Pause'}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleReset}
                    className="flex-1 h-20 rounded-2xl bg-indigo-500 text-white hover:bg-indigo-600 font-bold text-lg uppercase tracking-widest"
                  >
                    Done
                  </Button>
                )}
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save Preset Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card-bg w-full max-w-sm rounded-[32px] p-6 sm:p-8 border border-border-color shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
            >
              <h3 className="text-white font-bold text-xl mb-6">Save Preset</h3>
              <input
                type="text"
                placeholder="E.g. Morning HIIT"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                autoFocus
                className="w-full bg-white/[0.05] border border-border-color rounded-2xl p-4 text-white hover:bg-white/[0.08] focus:bg-white/[0.08] outline-none transition-all mb-8 font-bold placeholder:font-normal placeholder:opacity-50"
              />
              <div className="flex gap-3">
                <Button 
                  className="flex-1 h-14 rounded-2xl bg-white/[0.05] border border-border-color text-text-main hover:bg-white/[0.1] font-bold uppercase tracking-widest text-sm"
                  onClick={() => setShowSaveModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-14 rounded-2xl bg-accent-neon text-bg-dark hover:bg-accent-neon/90 font-bold uppercase tracking-widest text-sm shadow-[0_5px_15px_rgba(0,255,156,0.2)]"
                  disabled={!newPresetName.trim()}
                  onClick={() => {
                    if(newPresetName.trim()) {
                      setPresets([...presets, { 
                        id: Date.now().toString(), 
                        name: newPresetName.trim(), 
                        work: workDuration, 
                        rest: restDuration, 
                        rounds: totalRounds 
                      }]);
                      setShowSaveModal(false);
                      setNewPresetName('');
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
