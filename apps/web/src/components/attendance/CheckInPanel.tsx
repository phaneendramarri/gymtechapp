import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  Search,
  CheckCircle2,
  Camera,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  ScanFace,
  RefreshCw,
  Sparkles,
  Zap,
  X,
  AlertCircle,
  VideoOff,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import {
  extractSignatureFromUrl,
  deserializeFaceSignature,
  matchLiveVideoAgainstEnrolled,
  FaceSignature,
  EnrolledFaceMember,
  FaceMatchResult,
} from '@/lib/face-matcher';

interface CheckInPanelProps {
  onCheckIn: (code: string, method?: 'MANUAL' | 'QR' | 'FACE_ID') => Promise<void>;
  isCheckingIn: boolean;
  errorMessage: string | null;
  blockedMember: { id?: number; name?: string; expiryDate?: string } | null;
  lastCheckedMember: {
    name: string;
    code: string;
    alreadyCheckedIn?: boolean;
    checkInTime?: string;
  } | null;
}

export const CheckInPanel: React.FC<CheckInPanelProps> = ({
  onCheckIn,
  isCheckingIn,
  errorMessage,
  blockedMember,
  lastCheckedMember,
}) => {
  // Mode selection: 'search' (Manual Search) or 'face' (Face ID Biometric)
  const [activeMode, setActiveMode] = useState<'search' | 'face'>('search');

  // --- MANUAL SEARCH STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- FACE ID STATE ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMatchingFace, setIsMatchingFace] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState<FaceMatchResult | null>(null);
  const [isEnrolledLoading, setIsEnrolledLoading] = useState(false);
  const enrolledCacheRef = useRef<Array<{ member: EnrolledFaceMember; signature: FaceSignature }>>([]);
  const scanIntervalRef = useRef<any>(null);

  // Play pleasant chime on successful Face ID recognition
  const playSuccessChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // --- FETCH RECENT ACTIVE MEMBERS FOR QUICK ACCESS ---
  useEffect(() => {
    let mounted = true;
    api
      .getMembers({ limit: 4, status: 'ACTIVE' })
      .then((res) => {
        if (mounted && res.members) {
          setRecentMembers(res.members);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // --- LIVE DEBOUNCED SEARCH ---
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await api.getMembers({ search: searchQuery.trim(), limit: 6 });
        setSearchResults(res.members || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // --- WEBCAM LIFECYCLE FOR FACE ID ---
  const startWebcam = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err: any) {
      console.error('Webcam start error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera access denied. Please enable camera permissions in your browser.'
          : 'Unable to connect to camera device.'
      );
      setCameraActive(false);
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  // Attach stream to video tag
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, stream]);

  // Switch modes: start/stop webcam
  useEffect(() => {
    if (activeMode === 'face') {
      loadEnrolledMembers();
      startWebcam();
    } else {
      stopWebcam();
      setCurrentMatch(null);
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    }
    return () => {
      stopWebcam();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [activeMode]);

  // --- PRELOAD AND ENROLL MEMBER PHOTO SIGNATURES ---
  const loadEnrolledMembers = async () => {
    if (enrolledCacheRef.current.length > 0) {
      setEnrolledCount(enrolledCacheRef.current.length);
      return;
    }

    setIsEnrolledLoading(true);
    try {
      // Fetch members with limit 100
      const res = await api.getMembers({ limit: 100, status: 'ACTIVE' });
      const eligibleMembers = (res.members || []).filter((m: any) => Boolean(m.face_embedding || m.photo_url));

      const enrolledArr: Array<{ member: EnrolledFaceMember; signature: FaceSignature }> = [];

      for (const m of eligibleMembers) {
        // 1. Fast path: deserialize pre-computed face_embedding directly from DB!
        let sig: FaceSignature | null = deserializeFaceSignature(m.face_embedding);

        // 2. Fallback: extract from photo_url if embedding was not yet saved
        if (!sig && m.photo_url) {
          sig = await extractSignatureFromUrl(m.photo_url);
        }

        if (sig) {
          enrolledArr.push({
            member: {
              id: m.id,
              name: `${m.first_name} ${m.last_name || ''}`.trim(),
              memberCode: m.member_code,
              phone: m.phone,
              photoUrl: m.photo_url,
              faceEmbedding: m.face_embedding,
            },
            signature: sig,
          });
        }
      }

      enrolledCacheRef.current = enrolledArr;
      setEnrolledCount(enrolledArr.length);
    } catch (err) {
      console.error('Failed to load enrolled members for face comparison:', err);
    } finally {
      setIsEnrolledLoading(false);
    }
  };

  // --- REAL-TIME FACE SCANNING LOOP ---
  const performFaceScan = async () => {
    if (!videoRef.current || !cameraActive || isMatchingFace || isCheckingIn) return;
    if (enrolledCacheRef.current.length === 0) return;

    setIsMatchingFace(true);
    try {
      const match = await matchLiveVideoAgainstEnrolled(videoRef.current, enrolledCacheRef.current);
      if (match) {
        setCurrentMatch(match);
        if (match.isMatch && match.confidence >= 75) {
          playSuccessChime();
          // Auto check-in verified match
          await onCheckIn(match.member.memberCode, 'FACE_ID');
          // Reset match after check-in
          setTimeout(() => setCurrentMatch(null), 3500);
        }
      } else {
        setCurrentMatch(null);
      }
    } catch (err) {
      console.error('Face match error:', err);
    } finally {
      setIsMatchingFace(false);
    }
  };

  // Interval for auto-scanning
  useEffect(() => {
    if (activeMode === 'face' && cameraActive && autoScanEnabled) {
      scanIntervalRef.current = setInterval(() => {
        performFaceScan();
      }, 1500);
    } else {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    }
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [activeMode, cameraActive, autoScanEnabled, isCheckingIn]);

  // Handle Manual Direct Code Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // If we have search results, check in the first matching member
    if (searchResults.length > 0) {
      onCheckIn(searchResults[0].member_code || searchResults[0].phone || query, 'MANUAL');
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    onCheckIn(query, 'MANUAL');
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <Card className="rounded-xl border border-border bg-card shadow-md overflow-hidden flex flex-col">
      <CardHeader className="p-5 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="font-display text-base font-bold text-foreground flex items-center gap-2">
              Fast Check-In Terminal
              {activeMode === 'face' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                  AI Biometric
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-medium">
              Reception desk & floor entry verification
            </CardDescription>
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-secondary border border-border shrink-0">
            <button
              type="button"
              onClick={() => setActiveMode('search')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeMode === 'search'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Search className="size-3.5" /> Manual Search
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('face')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeMode === 'face'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ScanFace className="size-3.5 text-primary" /> Face ID
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 flex flex-col gap-4">
        {/* Error / Blocked Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 border-2 border-destructive/40 text-destructive flex flex-col gap-2.5 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="size-5 shrink-0 text-destructive mt-0.5" />
              <div className="flex flex-col">
                <span className="font-bold text-xs">Access Verification Check</span>
                <span className="text-xs text-destructive/90">{errorMessage}</span>
              </div>
            </div>
            {blockedMember?.id && (
              <div className="flex items-center gap-2 pt-1">
                <Button asChild size="sm" className="bg-destructive text-white hover:bg-destructive/90 font-bold text-xs h-8">
                  <a href={`#/members/${blockedMember.id}/renew`}>
                    Renew Membership Now <ArrowRight className="size-3.5 ml-1" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="text-xs h-8 border-destructive/40 text-destructive hover:bg-destructive/10">
                  <a href={`#/members/${blockedMember.id}`}>View Profile</a>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Success / Welcome Banner */}
        {lastCheckedMember && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-300 ${
              lastCheckedMember.alreadyCheckedIn
                ? 'bg-warn/10 border-warn/30 text-foreground'
                : 'bg-ok/10 border-ok/30 text-foreground'
            }`}
          >
            <div
              className={`size-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${
                lastCheckedMember.alreadyCheckedIn ? 'bg-warn' : 'bg-ok'
              }`}
            >
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-foreground">
                  {lastCheckedMember.alreadyCheckedIn ? 'Already Checked In!' : `Welcome, ${lastCheckedMember.name}!`}
                </span>
                <Badge variant={lastCheckedMember.alreadyCheckedIn ? 'outline' : 'default'} className="text-[10px]">
                  {lastCheckedMember.alreadyCheckedIn ? 'Duplicate' : 'Verified'}
                </Badge>
              </div>
              <span className="text-xs font-mono text-muted-foreground mt-0.5">
                Code: {lastCheckedMember.code} · Logged at {lastCheckedMember.checkInTime}
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 1: MANUAL SEARCH (CLEAN, FAST, AUTOCOMPLETE) */}
        {/* ========================================================================= */}
        {activeMode === 'search' && (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleManualSubmit} className="relative flex items-center">
              <Search className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member name, phone (+91), or code (MEM-1001)..."
                className="pl-10 pr-24 h-12 bg-secondary/40 text-sm font-medium border-border focus-visible:ring-primary"
                autoComplete="off"
                autoFocus
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-16 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
              <Button
                type="submit"
                size="sm"
                disabled={!searchQuery.trim() || isCheckingIn}
                className="absolute right-1.5 h-9 bg-primary text-primary-foreground font-bold text-xs shrink-0 px-3"
              >
                {isCheckingIn ? 'Checking...' : 'Check In'}
              </Button>
            </form>

            {/* Live Autocomplete Results */}
            {searchQuery.trim() !== '' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-1">
                  <span>
                    {isSearching
                      ? 'Searching database...'
                      : `${searchResults.length} matching member${searchResults.length === 1 ? '' : 's'}`}
                  </span>
                  <span className="text-[10px]">Press Enter to check in top match</span>
                </div>

                {isSearching ? (
                  <div className="space-y-2 py-2">
                    <div className="h-14 rounded-lg bg-secondary/50 animate-pulse" />
                    <div className="h-14 rounded-lg bg-secondary/50 animate-pulse" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-border bg-secondary/20 flex flex-col items-center justify-center text-center gap-1.5">
                    <AlertCircle className="size-6 text-muted-foreground opacity-60" />
                    <p className="text-xs font-semibold text-foreground">No member found for "{searchQuery}"</p>
                    <p className="text-[11px] text-muted-foreground">
                      Try searching with 10-digit mobile number or exact code.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                    {searchResults.map((member) => {
                      const fullName = `${member.first_name} ${member.last_name || ''}`.trim();
                      const isActive = member.status === 'ACTIVE';

                      return (
                        <div
                          key={member.id}
                          onClick={() => onCheckIn(member.member_code, 'MANUAL')}
                          className="group flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-secondary/40 transition-all cursor-pointer shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Member Avatar */}
                            <div className="size-10 rounded-full border border-border bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                              {member.photo_url ? (
                                <img src={member.photo_url} alt={fullName} className="size-full object-cover" />
                              ) : (
                                <span className="font-bold text-xs text-muted-foreground uppercase">
                                  {(member.first_name?.[0] || '') + (member.last_name?.[0] || '')}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground truncate">{fullName}</span>
                                <Badge
                                  variant={isActive ? 'default' : 'destructive'}
                                  className="text-[9px] px-1.5 py-0 h-4"
                                >
                                  {member.status}
                                </Badge>
                              </div>
                              <span className="text-[11px] font-mono text-muted-foreground truncate">
                                {member.member_code} · {member.phone}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            disabled={isCheckingIn}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCheckIn(member.member_code, 'MANUAL');
                            }}
                            className="h-8 text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all shrink-0 ml-2"
                          >
                            <UserCheck className="size-3.5 mr-1" />
                            Check In
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Quick Access Active Members (When search is empty) */}
            {!searchQuery && recentMembers.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Zap className="size-3 text-primary" />
                  Quick Check-In · Active Members
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recentMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isCheckingIn}
                      onClick={() => onCheckIn(m.member_code, 'MANUAL')}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-secondary/30 hover:border-primary hover:bg-secondary/70 transition-all text-left group"
                    >
                      <div className="size-8 rounded-full border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="font-bold text-[10px] text-muted-foreground">
                            {(m.first_name?.[0] || '') + (m.last_name?.[0] || '')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                          {m.first_name} {m.last_name || ''}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground truncate">{m.member_code}</span>
                      </div>
                      <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 2: BIOMETRIC FACE ID CAMERA TERMINAL */}
        {/* ========================================================================= */}
        {activeMode === 'face' && (
          <div className="flex flex-col gap-4">
            {/* Camera Viewfinder Box */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-border bg-black aspect-[4/3] flex items-center justify-center shadow-inner group">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="size-full object-cover transform -scale-x-100"
                  />

                  {/* High-Tech Biometric HUD Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                    {/* Top HUD Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-mono">
                        <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                        LIVE CAMERA
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-mono">
                        <ScanFace className="size-3 text-primary" />
                        {isEnrolledLoading ? 'Loading models...' : `${enrolledCount} Faces Enrolled`}
                      </div>
                    </div>

                    {/* Central Face Target Reticle */}
                    <div className="relative mx-auto size-48 sm:size-56 rounded-3xl border-2 border-dashed border-primary/50 flex items-center justify-center">
                      {/* Biometric Corner Brackets */}
                      <div className="absolute -top-1.5 -left-1.5 size-5 border-t-3 border-l-3 border-primary rounded-tl-lg" />
                      <div className="absolute -top-1.5 -right-1.5 size-5 border-t-3 border-r-3 border-primary rounded-tr-lg" />
                      <div className="absolute -bottom-1.5 -left-1.5 size-5 border-b-3 border-l-3 border-primary rounded-bl-lg" />
                      <div className="absolute -bottom-1.5 -right-1.5 size-5 border-b-3 border-r-3 border-primary rounded-br-lg" />

                      {/* Animated Laser Scanning Line */}
                      <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_var(--primary)] animate-[bounce_2s_infinite]" />

                      {/* Status indicator inside reticle */}
                      {isMatchingFace ? (
                        <div className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-mono flex items-center gap-1.5 animate-pulse">
                          <Sparkles className="size-3 text-primary animate-spin" />
                          Comparing Face...
                        </div>
                      ) : null}
                    </div>

                    {/* Bottom HUD Hint */}
                    <div className="text-center">
                      <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/80 text-[11px] font-medium border border-white/10">
                        Align member face inside the reticle
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
                  <div className="size-16 rounded-2xl bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground">
                    <VideoOff className="size-8 opacity-70" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-xs">
                    <span className="text-sm font-bold text-foreground">
                      {cameraError ? 'Camera Access Required' : 'Camera is Inactive'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cameraError || 'Allow camera access on this device to use real-time biometric face check-in.'}
                    </span>
                  </div>
                  <Button size="sm" onClick={startWebcam} className="bg-primary text-primary-foreground font-bold text-xs gap-1.5">
                    <Camera className="size-3.5" /> Start Camera
                  </Button>
                </div>
              )}
            </div>

            {/* Live Match Card (When Face is Recognized) */}
            {currentMatch && currentMatch.confidence >= 65 && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-200 ${
                  currentMatch.isMatch
                    ? 'bg-ok/10 border-ok/40 text-foreground'
                    : 'bg-warn/10 border-warn/40 text-foreground'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-11 rounded-full border-2 border-primary overflow-hidden shrink-0">
                    {currentMatch.member.photoUrl ? (
                      <img src={currentMatch.member.photoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="size-full bg-secondary flex items-center justify-center font-bold text-xs text-muted-foreground">
                        {currentMatch.member.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground truncate">
                        {currentMatch.member.name}
                      </span>
                      <Badge variant={currentMatch.isMatch ? 'default' : 'outline'} className="text-[10px]">
                        {currentMatch.confidence}% Match
                      </Badge>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {currentMatch.member.memberCode} ·{' '}
                      {currentMatch.isMatch ? 'Authenticating...' : 'Verification in progress'}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={isCheckingIn}
                  onClick={() => onCheckIn(currentMatch.member.memberCode, 'FACE_ID')}
                  className="bg-primary text-primary-foreground font-bold text-xs shrink-0"
                >
                  <UserCheck className="size-3.5 mr-1" />
                  Check In
                </Button>
              </div>
            )}

            {/* Face ID Controls & Enrolled Notice */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{enrolledCount}</span> enrolled member
                photos ready for biometric matching.
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={performFaceScan}
                  disabled={!cameraActive || isMatchingFace || isCheckingIn}
                  className="h-8 text-xs font-semibold gap-1.5 border-border"
                >
                  <RefreshCw className={`size-3.5 ${isMatchingFace ? 'animate-spin' : ''}`} />
                  Scan Now
                </Button>
                <Button
                  type="button"
                  variant={autoScanEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  <Zap className="size-3.5" />
                  {autoScanEnabled ? 'Auto-Scan ON' : 'Auto-Scan OFF'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
