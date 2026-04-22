/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Upload, 
  Download, 
  Type, 
  Moon, 
  Sun, 
  Save, 
  Trash2, 
  Loader2,
  Scan,
  AlertCircle
} from 'lucide-react';
import { cn } from './lib/utils';
import { performOCR } from './lib/ocr';
import { exportToPDF, exportToDocx, exportToTxt } from './lib/export';
import { db, auth, signIn, logOut } from './lib/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import confetti from 'canvas-confetti';

interface Project {
  id: string;
  title: string;
  content: string;
  fontFamily: string;
  createdAt: any;
}

export default function App() {
  const [text, setText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [customFonts, setCustomFonts] = useState<{name: string, url: string}[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    const q = query(
      collection(db, 'projects'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
    setProjects(p);
  }, [user]);

  useEffect(() => {
    if (user) loadProjects();
  }, [user, loadProjects]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setText(''); // Clear previous text on new selection
  };

  const handleConvert = async () => {
    if (!selectedFile) {
      alert('প্রথমে একটি ছবি আপলোড করুন।');
      return;
    }

    setLoading(true);
    setProgress(0);
    try {
      const extractedText = await performOCR(selectedFile, (p) => setProgress(p));
      setText(extractedText);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.error(error);
      alert('OCR failed. Please try another image.');
    } finally {
      setLoading(false);
    }
  };

  const handleFontUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fontName = file.name.split('.')[0];
    const url = URL.createObjectURL(file);
    
    const newStyle = document.createElement('style');
    newStyle.appendChild(document.createTextNode(`
      @font-face {
        font-family: '${fontName}';
        src: url('${url}');
      }
    `));
    document.head.appendChild(newStyle);
    
    setCustomFonts([...customFonts, { name: fontName, url }]);
    setFontFamily(fontName);
  };

  const saveProject = async () => {
    if (!user) {
      alert('Please sign in to save projects.');
      return;
    }
    if (!text.trim()) return;

    try {
      await addDoc(collection(db, 'projects'), {
        userId: user.uid,
        title: text.slice(0, 20) || 'Untitled',
        content: text,
        fontFamily,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      loadProjects();
      alert('Project saved!');
    } catch (error) {
      console.error(error);
      alert('Failed to save project.');
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      darkMode ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F0] text-[#141414]"
    )}>
      {/* Header */}
      <header className="border-b border-current/10 sticky top-0 bg-inherit z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scan className="w-6 h-6" />
            <h1 className="font-bold text-xl tracking-tight uppercase">OCR.Editor</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowProjects(!showProjects)}
                  className="text-sm font-medium hover:underline"
                >
                  My Projects
                </button>
                <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-current/10" alt="Avatar" />
                <button onClick={logOut} className="text-sm opacity-60 hover:opacity-100">Sign Out</button>
              </div>
            ) : (
              <button onClick={signIn} className="text-sm font-medium">Sign In</button>
            )}
            
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-current/5 transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: UI Controls */}
        <div className="lg:col-span-4 space-y-8">
          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest font-bold opacity-50">1. Source</h2>
            <div className="relative">
              <input 
                id="image-upload-input"
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
              <label 
                htmlFor="image-upload-input"
                className={cn(
                  "border-2 border-dashed border-current/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all hover:border-blue-500 hover:bg-blue-500/5 min-h-[280px] relative overflow-hidden cursor-pointer group",
                  loading && "opacity-100 pointer-events-none",
                  selectedFile && "border-blue-500 bg-blue-500/5"
                )}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} className={cn("absolute inset-0 w-full h-full object-contain transition-all", loading ? "opacity-40 blur-[2px]" : "opacity-60")} alt="Preview" />
                    
                    {loading && (
                      <>
                        {/* Scanner Line Effect */}
                        <motion.div 
                          initial={{ top: 0 }}
                          animate={{ top: '100%' }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-20"
                        />
                        
                        {/* Unique Circular Progress */}
                        <div className="z-30 relative flex flex-col items-center gap-4">
                          <div className="relative w-24 h-24">
                            <svg className="w-full h-full -rotate-90">
                              <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-current/10"
                              />
                              <motion.circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray="251.2"
                                animate={{ strokeDashoffset: 251.2 - (251.2 * progress) }}
                                className="text-blue-500"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xl font-bold font-mono">
                              {Math.round(progress * 100)}%
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-blue-500 uppercase tracking-widest text-xs animate-pulse">Scanning...</p>
                            <p className="text-[10px] opacity-60 mt-1">Gemini 3.1 Pro is analyzing</p>
                          </div>
                        </div>
                      </>
                    )}

                    {!loading && (
                      <div className="z-10 bg-black/60 text-white px-4 py-2 rounded-full text-xs backdrop-blur-md flex items-center gap-2">
                        <Upload size={14} /> Change Image
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4 z-10">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                      <Upload size={32} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg">ছবি আপলোড করুন</p>
                      <p className="text-xs opacity-50 mt-1">ক্লিক করুন অথবা ছবি এখানে টেনে আনুন</p>
                    </div>
                  </div>
                )}
              </label>
              
              {selectedFile && !loading && (
                <button 
                  onClick={() => { setSelectedFile(null); setImagePreview(null); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-colors z-20"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {selectedFile && !loading && (
               <p className="text-[10px] font-mono opacity-50 truncate">Selected: {selectedFile.name}</p>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest font-bold opacity-50">2. Typography</h2>
            <div className="space-y-4 bg-current/5 p-6 rounded-2xl">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Type size={16} /> Font Family
                </label>
                <select 
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full bg-inherit border border-current/20 rounded-lg p-2 text-sm focus:outline-none focus:border-orange-500"
                >
                  <optgroup label="System">
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                  </optgroup>
                  <optgroup label="Bengali (Native)">
                    <option value="Hind Siliguri">Hind Siliguri</option>
                    <option value="Noto Sans Bengali">Noto Sans Bengali</option>
                    <option value="Kalpurush">Kalpurush</option>
                    <option value="SutonnyMJ">SutonnyMJ</option>
                    <option value="SolaimanLipi">SolaimanLipi</option>
                  </optgroup>
                  {customFonts.length > 0 && (
                    <optgroup label="Uploaded">
                      {customFonts.map(f => (
                        <option key={f.name} value={f.name}>{f.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center px-4 py-2 bg-current/10 rounded-lg cursor-pointer hover:bg-current/20 transition-colors text-xs font-bold uppercase tracking-wider">
                  <Upload size={14} className="mr-2" /> Upload TTF/OTF
                  <input type="file" accept=".ttf,.otf" className="hidden" onChange={handleFontUpload} />
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest font-bold opacity-50">3. Submit & Convert</h2>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={handleConvert}
                disabled={loading || !selectedFile}
                className={cn(
                  "flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95",
                  (loading || !selectedFile) && "opacity-50 grayscale cursor-not-allowed"
                )}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Scan size={20} />}
                সাবমিট করুন
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest font-bold opacity-50">4. Actions & Export</h2>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={saveProject}
                className="flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-3 font-semibold hover:bg-orange-600 transition-colors col-span-2 shadow-sm"
              >
                <Save size={18} /> Save Project
              </button>
              <button 
                onClick={() => exportToPDF(text, fontFamily)}
                className="flex items-center justify-center gap-2 bg-current/5 border border-current/10 rounded-xl py-3 text-sm hover:bg-current/10 transition-colors"
                title="Download PDF"
              >
                <FileText size={16} /> PDF
              </button>
              <button 
                onClick={() => exportToDocx(text, fontFamily)}
                className="flex items-center justify-center gap-2 bg-current/5 border border-current/10 rounded-xl py-3 text-sm hover:bg-current/10 transition-colors"
                title="Download DOCX"
              >
                <Download size={16} /> DOCX
              </button>
              <button 
                onClick={() => exportToTxt(text)}
                className="flex items-center justify-center gap-2 bg-current/5 border border-current/10 rounded-xl py-3 text-sm hover:bg-current/10 transition-colors col-span-2"
              >
                <FileText size={16} /> Download TXT
              </button>
              <button 
                onClick={() => setText('')}
                className="flex items-center justify-center gap-2 text-red-500 rounded-xl py-3 text-sm hover:bg-red-500/10 transition-colors col-span-2 border border-red-500/20"
              >
                <Trash2 size={16} /> Clear Editor
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Editor */}
        <div className="lg:col-span-8 flex flex-col h-full bg-white dark:bg-[#111] rounded-3xl shadow-2xl overflow-hidden border border-current/10">
          <div className="px-6 py-4 flex items-center justify-between border-b border-current/10 bg-current/[0.02]">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-tighter opacity-60">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live Editor
            </div>
            <div className="text-[10px] font-mono opacity-40">
              CHARS: {text.length} | WORDS: {text.split(/\s+/).filter(Boolean).length}
            </div>
          </div>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ fontFamily }}
            placeholder="Extracted text will appear here. Start typing or upload an image..."
            className="flex-1 w-full p-10 bg-transparent resize-none focus:outline-none text-xl leading-relaxed min-h-[500px]"
          />
        </div>
      </main>

      {/* Projects Sidebar/Modal */}
      <AnimatePresence>
        {showProjects && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProjects(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-[#0A0A0A] z-[70] shadow-2xl p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold italic tracking-tight">Saved Projects</h2>
                <button onClick={() => setShowProjects(false)} className="p-2 rounded-full hover:bg-current/5">
                  <Trash2 className="rotate-45" />
                </button>
              </div>
              
              <div className="space-y-4">
                {projects.length > 0 ? (projects.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => {
                      setText(p.content);
                      setFontFamily(p.fontFamily);
                      setShowProjects(false);
                    }}
                    className="p-4 rounded-2xl border border-current/10 hover:bg-current/5 cursor-pointer transition-all group"
                  >
                    <h3 className="font-semibold truncate">{p.title}</h3>
                    <p className="text-xs opacity-50 mt-1">{new Date(p.createdAt?.toDate()).toLocaleDateString()}</p>
                    <div className="mt-3 text-sm line-clamp-2 opacity-70 group-hover:opacity-100 transition-opacity">
                      {p.content}
                    </div>
                  </div>
                ))) : (
                  <div className="py-20 text-center space-y-4 opacity-40">
                    <FileText size={48} className="mx-auto" />
                    <p>No projects saved yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-current/10 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest opacity-40">
            <span>Privacy First</span>
            <div className="w-1 h-1 rounded-full bg-current" />
            <span>GPU Accelerated</span>
            <div className="w-1 h-1 rounded-full bg-current" />
            <span>Open Source</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <AlertCircle size={14} className="text-orange-500" />
            <p className="text-[10px] font-mono text-orange-500">
              NOTE: BENGALI OCR REQUIRES CLEAR HIGH-CONTRAST IMAGES FOR ACCURACY.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
