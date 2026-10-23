import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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
  QrCode,
  UserX,
  Pause,
  Play,
  Clock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import {
  loadFaceApiModels,
  extractFaceDescriptor,
  deserializeDescriptor,
  extractDescriptorFromImageUrl,
  findBestFaceMatch,
  type EnrolledFaceRecord,
  type EnrolledFaceMember,
  type FaceMatch,
} from '@/lib/face-api';
import { QRScanner } from './QRScanner';
import { speakAnnouncement, isAudioMuted, toggleAudioMute, testAudioAnnouncement } from '@/lib/speech';

interface CheckInPanelProps {
  onCheckIn: (code: string, method?: 'MANUAL' | 'QR' | 'FACE_ID', override?: boolean) => Promise<void>;
  isCheckingIn: boolean;
  errorMessage: string | null;
  blockedMember: { id?: number; name?: string; expiryDate?: string } | null;
  lastCheckedMember: {
    name: string;
    code: string;
    phone?: string;
    plan?: string;
    alreadyCheckedIn?: boolean;
    checkInTime?: string;
  } | null;
  canOverride?: boolean;
}

export const CheckInPanel: React.FC<CheckInPanelProps> = ({
  onCheckIn,
  isCheckingIn,
  errorMessage,
  blockedMember,
  lastCheckedMember,
  canOverride,
}) => {
  // Mode selection: 'search' (Manual Search), 'qr' (QR Scanner), or 'face' (Face ID Biometric)
  const [activeMode, setActiveMode] = useState<'search' | 'qr' | 'face'>('search');
  const [audioMuted, setAudioMutedState] = useState(() => isAudioMuted());

  // --- MANUAL SEARCH STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- QR SCANNER STATE ---
  const [showQRScanner, setShowQRScanner] = useState(false);

  // --- FACE ID STATE ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMatchingFace, setIsMatchingFace] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [isScanPaused, setIsScanPaused] = useState(false);
  const [cooldownCountdown, setCooldownCountdown] = useState<number | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState<FaceMatch | null>(null);
  const [isEnrolledLoading, setIsEnrolledLoading] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [scanAttemptCount, setScanAttemptCount] = useState(0);
  const [noMatchDetected, setNoMatchDetected] = useState(false);
  const enrolledCacheRef = useRef<EnrolledFaceRecord[]>([]);
  const scanIntervalRef = useRef<any>(null);

  // --- AUDIO SYNTHESIS FEEDBACK (Web Audio API) ---
  const playToneSequence = (
    notes: { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number }[]
  ) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = note.type || 'sine';
        osc.frequency.setValueAtTime(note.freq, now + note.start);
        gain.gain.setValueAtTime(note.gain ?? 0.16, now + note.start);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + note.start);
        osc.stop(now + note.start + note.dur);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // 1. Success / Welcome Chime: Uplifting 3-tone arpeggio (C5 - E5 - G5 - C6)
  const playSuccessChime = () => {
    playToneSequence([
      { freq: 523.25, start: 0.0, dur: 0.16, type: 'sine', gain: 0.2 },
      { freq: 659.25, start: 0.1, dur: 0.2, type: 'sine', gain: 0.22 },
      { freq: 783.99, start: 0.2, dur: 0.26, type: 'sine', gain: 0.24 },
      { freq: 1046.5, start: 0.32, dur: 0.42, type: 'sine', gain: 0.28 },
    ]);
  };

  // 2. Duplicate Entry Chime ("Already Checked In / Duplicate!"): Distinct amber alert double-pulse
  const playDuplicateWarningChime = () => {
    playToneSequence([
      { freq: 740, start: 0.0, dur: 0.14, type: 'triangle', gain: 0.25 },
      { freq: 587, start: 0.15, dur: 0.14, type: 'triangle', gain: 0.25 },
      { freq: 740, start: 0.32, dur: 0.22, type: 'triangle', gain: 0.28 },
    ]);
  };

  // 3. Denied / Expired Chime: Low warning buzz tone
  const playDeniedChime = () => {
    playToneSequence([
      { freq: 220, start: 0.0, dur: 0.2, type: 'sawtooth', gain: 0.22 },
      { freq: 180, start: 0.18, dur: 0.28, type: 'sawtooth', gain: 0.25 },
    ]);
  };

  // 4. Face Target Locked: Soft pleasant ping
  const playFaceLockChime = () => {
    playToneSequence([
      { freq: 880, start: 0.0, dur: 0.14, type: 'sine', gain: 0.14 },
    ]);
  };

  // Track check-in audio triggers so sounds play accurately upon check-in completion
  const prevCheckedMemberRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastCheckedMember) {
      prevCheckedMemberRef.current = null;
      return;
    }
    const key = `${lastCheckedMember.code}-${lastCheckedMember.checkInTime}-${lastCheckedMember.alreadyCheckedIn}`;
    if (prevCheckedMemberRef.current !== key) {
      prevCheckedMemberRef.current = key;
      if (lastCheckedMember.alreadyCheckedIn) {
        playDuplicateWarningChime();
        speakAnnouncement(`Duplicate! ${lastCheckedMember.name} has already checked in today.`);
      } else {
        playSuccessChime();
        speakAnnouncement(`Thank you, ${lastCheckedMember.name}! Enjoy your workout.`);
      }
    }
  }, [lastCheckedMember]);

  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!errorMessage) {
      prevErrorRef.current = null;
      return;
    }
    if (prevErrorRef.current !== errorMessage) {
      prevErrorRef.current = errorMessage;
      playDeniedChime();
      if (errorMessage.toLowerCase().includes('expired') || errorMessage.includes('ACCESS DENIED')) {
        speakAnnouncement('Access denied! Membership is expired. Please visit the front desk.');
      }
    }
  }, [errorMessage]);

  // Cooldown countdown effect after check-in
  useEffect(() => {
    if (cooldownCountdown === null) return;
    if (cooldownCountdown <= 0) {
      setCooldownCountdown(null);
      setIsScanPaused(false);
      return;
    }
    const timer = setTimeout(() => {
      setCooldownCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownCountdown]);

  // Switch to manual search fallback
  const switchToManualSearch = (initialQuery = '') => {
    stopWebcam();
    setCurrentMatch(null);
    setActiveMode('search');
    if (initialQuery) setSearchQuery(initialQuery);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
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
      streamRef.current = mediaStream;
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setCameraActive(false);
    setIsMatchingFace(false);
    setIsScanPaused(true);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
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
      setNoMatchDetected(false);
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    }
    return () => {
      stopWebcam();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [activeMode]);

  // --- PRELOAD AND ENROLL MEMBER PHOTO DESCRIPTORS ---
  const loadEnrolledMembers = async () => {
    if (enrolledCacheRef.current.length > 0) {
      setEnrolledCount(enrolledCacheRef.current.length);
      return;
    }

    setIsEnrolledLoading(true);
    try {
      // 1. Initialize @vladmandic/face-api models
      const loaded = await loadFaceApiModels();
      setModelsReady(loaded);

      // 2. Fetch active members (with fallback to all members if none returned)
      const res = await api.getMembers({ limit: 200, status: 'ACTIVE' });
      let membersList = res.members || [];
      if (membersList.length === 0) {
        const fallbackRes = await api.getMembers({ limit: 200 });
        membersList = fallbackRes.members || [];
      }
      const eligibleMembers = membersList.filter((m: any) => Boolean(m.faceEmbedding || m.photoUrl));

      const enrolledArr: EnrolledFaceRecord[] = [];

      for (const m of eligibleMembers) {
        // Fast path: deserialize pre-computed 128-D descriptor directly from DB
        let descriptor = deserializeDescriptor(m.faceEmbedding);

        // Fallback: extract from photoUrl if embedding was not saved yet
        if (!descriptor && m.photoUrl) {
          descriptor = await extractDescriptorFromImageUrl(m.photoUrl);
        }

        if (descriptor) {
          enrolledArr.push({
            member: {
              id: m.id,
              name: `${m.firstName} ${m.lastName || ''}`.trim(),
              memberCode: m.memberCode,
              phone: m.phone,
              photoUrl: m.photoUrl,
              faceEmbedding: m.faceEmbedding,
              status: m.status,
              planName: m.planName,
              membershipStatus: m.membershipStatus,
              endDate: m.endDate,
            },
            descriptor,
          });
        }
      }

      enrolledCacheRef.current = enrolledArr;
      setEnrolledCount(enrolledArr.length);
    } catch (err) {
      console.error('Failed to load enrolled members for face recognition:', err);
    } finally {
      setIsEnrolledLoading(false);
    }
  };

  // --- REAL-TIME FACE SCANNING & EUCLIDEAN MATCHING LOOP ---
  const performFaceScan = async () => {
    if (!videoRef.current || !cameraActive || isScanPaused || cooldownCountdown !== null || isMatchingFace || isCheckingIn) return;
    if (enrolledCacheRef.current.length === 0) return;

    setIsMatchingFace(true);
    setScanAttemptCount((c) => c + 1);

    try {
      // 1. Detect face and compute 128-D descriptor from live camera video frame
      const liveDescriptor = await extractFaceDescriptor(videoRef.current);

      if (liveDescriptor) {
        // 2. Compare using Euclidean distance against enrolled members (adaptive 0.60-0.62 threshold)
        const matchThreshold = enrolledCacheRef.current.length <= 3 ? 0.62 : 0.60;
        const match = findBestFaceMatch(liveDescriptor, enrolledCacheRef.current, matchThreshold);

        if (match && match.isConfidentMatch) {
          setCurrentMatch(match);
          setNoMatchDetected(false);
          playFaceLockChime();
        } else if (match) {
          // Weak match or unknown face
          setCurrentMatch(match);
          setNoMatchDetected(!match.isConfidentMatch);
        }
      } else {
        // No face in reticle
        if (!currentMatch?.isConfidentMatch) {
          setCurrentMatch(null);
        }
      }
    } catch (err) {
      console.error('Face match error:', err);
    } finally {
      setIsMatchingFace(false);
    }
  };

  // Interval for auto-scanning — stops cleanly when paused, cooled down, or camera stopped
  useEffect(() => {
    if (
      activeMode === 'face' &&
      cameraActive &&
      autoScanEnabled &&
      !isScanPaused &&
      cooldownCountdown === null &&
      !currentMatch?.isConfidentMatch
    ) {
      scanIntervalRef.current = setInterval(() => {
        performFaceScan();
      }, 1200);
    } else {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    }
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [activeMode, cameraActive, autoScanEnabled, isScanPaused, cooldownCountdown, isCheckingIn, currentMatch]);

  // Controls: Pause, Resume, and Stop
  const handlePauseScan = () => {
    setIsScanPaused(true);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
  };

  const handleResumeScan = () => {
    setIsScanPaused(false);
    setCooldownCountdown(null);
    if (!cameraActive) {
      startWebcam();
    }
  };

  const handleStopCamera = () => {
    stopWebcam();
    setIsScanPaused(true);
    setCurrentMatch(null);
    setNoMatchDetected(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
  };

  // Handle Confirmed Check-In
  const handleConfirmFaceCheckIn = async () => {
    if (!currentMatch) return;
    const memberCode = currentMatch.member.memberCode;
    // Set 4-second cooldown to allow the member to walk past without immediately re-scanning
    setCooldownCountdown(4);
    setIsScanPaused(true);
    await onCheckIn(memberCode, 'FACE_ID');
    setCurrentMatch(null);
    setNoMatchDetected(false);
  };

  // Handle Manual Direct Code Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // If we have search results, check in the first matching member
    if (searchResults.length > 0) {
      onCheckIn(searchResults[0].memberCode || searchResults[0].phone || query, 'MANUAL');
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
                  Face ID (@vladmandic/face-api)
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-medium">
              Reception desk & floor entry verification
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next = toggleAudioMute();
                setAudioMutedState(next);
                if (!next) {
                  testAudioAnnouncement();
                }
              }}
              className="h-8 px-2.5 text-xs border-border hover:bg-secondary cursor-pointer"
              title={audioMuted ? 'Voice announcements muted. Click to enable.' : 'Voice announcements active. Click to mute.'}
            >
              {audioMuted ? (
                <>
                  <VolumeX className="size-3.5 text-muted-foreground mr-1" />
                  <span className="text-[11px] font-mono text-muted-foreground">Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="size-3.5 text-primary mr-1" />
                  <span className="text-[11px] font-mono text-primary font-bold">Voice ON</span>
                </>
              )}
            </Button>

            {/* Mode Switcher Tabs */}
            <Tabs
              value={activeMode}
              onValueChange={(val) => {
                if (val !== 'face') {
                  handleStopCamera();
                }
                setActiveMode(val as 'search' | 'qr' | 'face');
              }}
              className="shrink-0"
            >
              <TabsList className="h-8">
                <TabsTrigger value="search" className="gap-1.5 text-xs">
                  <Search className="size-3.5" /> Manual
                </TabsTrigger>
                <TabsTrigger value="qr" className="gap-1.5 text-xs">
                  <QrCode className="size-3.5" /> QR Scan
                </TabsTrigger>
                <TabsTrigger value="face" className="gap-1.5 text-xs">
                  <ScanFace className="size-3.5 text-primary" /> Face ID
                </TabsTrigger>
              </TabsList>
            </Tabs>
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
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button asChild size="sm" className="bg-destructive text-white hover:bg-destructive/90 font-bold text-xs h-8">
                  <Link to={`/members/${blockedMember.id}/renew`}>
                    Renew Membership Now <ArrowRight className="size-3.5 ml-1" />
                  </Link>
                </Button>
                {canOverride && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isCheckingIn}
                    onClick={() => onCheckIn(String(blockedMember.id), 'MANUAL', true)}
                    className="text-xs h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    Override Check-in
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="text-xs h-8 border-border text-foreground hover:bg-muted">
                  <Link to={`/members/${blockedMember.id}`}>View Profile</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Success / Duplicate Push Banner */}
        {lastCheckedMember && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-300 ${
              lastCheckedMember.alreadyCheckedIn
                ? 'bg-amber-500/15 border-amber-500/50 text-foreground shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'bg-ok/10 border-ok/30 text-foreground'
            }`}
          >
            <div
              className={`size-11 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${
                lastCheckedMember.alreadyCheckedIn ? 'bg-amber-500 shadow-sm' : 'bg-ok'
              }`}
            >
              {lastCheckedMember.alreadyCheckedIn ? (
                <AlertCircle className="size-6 text-white" />
              ) : (
                <CheckCircle2 className="size-6" />
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                  {lastCheckedMember.alreadyCheckedIn ? (
                    <>
                      <span className="text-amber-600 dark:text-amber-400 font-extrabold tracking-wide">
                        ⚠️ DUPLICATE CHECK-IN DETECTED
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">({lastCheckedMember.name})</span>
                    </>
                  ) : (
                    `Welcome, ${lastCheckedMember.name}!`
                  )}
                </span>
                <Badge
                  variant={lastCheckedMember.alreadyCheckedIn ? 'destructive' : 'default'}
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    lastCheckedMember.alreadyCheckedIn
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent'
                      : ''
                  }`}
                >
                  {lastCheckedMember.alreadyCheckedIn ? 'Duplicate Push' : 'Verified'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lastCheckedMember.alreadyCheckedIn ? (
                  <>
                    <strong className="text-foreground">{lastCheckedMember.name}</strong> has already checked in today at{' '}
                    <span className="font-mono font-semibold text-foreground">{lastCheckedMember.checkInTime}</span>. Duplicate check-in push was recorded and flagged.
                  </>
                ) : (
                  <>
                    Code: <span className="font-mono font-semibold text-foreground">{lastCheckedMember.code}</span>
                    {lastCheckedMember.plan ? ` · Plan: ${lastCheckedMember.plan}` : ''} · Logged at{' '}
                    <span className="font-mono font-semibold text-foreground">{lastCheckedMember.checkInTime}</span>
                  </>
                )}
              </p>
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
                      const fullName = `${member.firstName} ${member.lastName || ''}`.trim();
                      const isActive = member.status === 'ACTIVE';

                      return (
                        <div
                          key={member.id}
                          onClick={() => onCheckIn(member.memberCode, 'MANUAL')}
                          className="group flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-secondary/40 transition-all cursor-pointer shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Member Avatar */}
                            <div className="size-10 rounded-full border border-border bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={fullName} className="size-full object-cover" />
                              ) : (
                                <span className="font-bold text-xs text-muted-foreground uppercase">
                                  {(member.firstName?.[0] || '') + (member.lastName?.[0] || '')}
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
                                {member.memberCode} · {member.phone}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            disabled={isCheckingIn}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCheckIn(member.memberCode, 'MANUAL');
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
                      onClick={() => onCheckIn(m.memberCode, 'MANUAL')}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-secondary/30 hover:border-primary hover:bg-secondary/70 transition-all text-left group cursor-pointer"
                    >
                      <div className="size-8 rounded-full border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
                        {m.photoUrl ? (
                          <img src={m.photoUrl} alt={m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : 'Member photo'} className="size-full object-cover" />
                        ) : (
                          <span className="font-bold text-[10px] text-muted-foreground">
                            {(m.firstName?.[0] || '') + (m.lastName?.[0] || '')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                          {m.firstName} {m.lastName || ''}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground truncate">{m.memberCode}</span>
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
        {/* MODE 2: QR CODE SCANNER */}
        {/* ========================================================================= */}
        {activeMode === 'qr' && (
          <div className="flex flex-col gap-4">
            <div className="p-6 rounded-xl border border-border bg-secondary/20 flex flex-col items-center justify-center text-center gap-3">
              <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <QrCode className="size-8 text-primary" />
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <span className="text-sm font-bold text-foreground">Scan Member QR Code</span>
                <span className="text-xs text-muted-foreground">
                  Point your device camera at the member's QR code to check them in instantly.
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => setShowQRScanner(true)}
                className="bg-primary text-primary-foreground font-bold text-xs gap-1.5"
              >
                <Camera className="size-3.5" /> Open QR Scanner
              </Button>
            </div>

            {showQRScanner && (
              <QRScanner
                onScan={async (data) => {
                  setShowQRScanner(false);
                  const match = data.match(/gymtech:\/\/checkin\/(\d+)\/(\d+)\/(.+)/);
                  if (match) {
                    const [, , , memberCode] = match;
                    await onCheckIn(memberCode, 'QR');
                  } else {
                    await onCheckIn(data, 'QR');
                  }
                }}
                onClose={() => setShowQRScanner(false)}
                isProcessing={isCheckingIn}
              />
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-secondary/40 border border-border">
              <span className="font-mono">💡 Tip:</span> Members can download their QR code from their profile page.
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 3: BIOMETRIC FACE ID CAMERA TERMINAL (@vladmandic/face-api) */}
        {/* ========================================================================= */}
        {activeMode === 'face' && (
          <div className="flex flex-col gap-4">
            {/* Camera Viewfinder Box */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-border bg-black aspect-4/3 flex items-center justify-center shadow-inner group">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="size-full object-cover transform -scale-x-100"
                  />

                  {/* Biometric HUD Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                    {/* Top HUD Status & Stop / Pause Action Bar */}
                    <div className="flex items-center justify-between gap-2 pointer-events-auto flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isScanPaused ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/85 backdrop-blur-md text-white text-[10px] font-mono font-bold shadow-xs">
                            <Pause className="size-3" />
                            SCAN PAUSED
                          </div>
                        ) : cooldownCountdown !== null ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-600/85 backdrop-blur-md text-white text-[10px] font-mono font-bold shadow-xs">
                            <Clock className="size-3" />
                            COOLDOWN ({cooldownCountdown}s)
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-white text-[10px] font-mono">
                            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE CAMERA
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-white text-[10px] font-mono">
                          <ScanFace className="size-3 text-primary" />
                          {isEnrolledLoading ? 'Loading models...' : `${enrolledCount} Faces Enrolled`}
                        </div>
                      </div>

                      {/* Prominent Viewfinder Stop & Pause Buttons */}
                      <div className="flex items-center gap-1.5">
                        {isScanPaused || cooldownCountdown !== null ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleResumeScan}
                            className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-sm cursor-pointer"
                          >
                            <Play className="size-3" /> Resume Scan
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={handlePauseScan}
                            className="h-7 px-2.5 text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white gap-1 backdrop-blur-md border border-white/20 shadow-sm cursor-pointer"
                          >
                            <Pause className="size-3" /> Pause Scan
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleStopCamera}
                          className="h-8 px-3 text-xs font-bold bg-destructive hover:bg-destructive/90 text-white gap-1.5 shadow-md cursor-pointer border border-white/20"
                        >
                          <VideoOff className="size-3.5" /> Stop Camera
                        </Button>
                      </div>
                    </div>

                    {/* Central Face Target Reticle */}
                    <div
                      className={`relative mx-auto size-48 sm:size-56 rounded-3xl border-2 transition-all duration-300 flex items-center justify-center ${
                        currentMatch?.isConfidentMatch
                          ? 'border-ok scale-105 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                          : isScanPaused
                          ? 'border-dashed border-amber-500/70 bg-amber-500/5'
                          : cooldownCountdown !== null
                          ? 'border-dashed border-cyan-500/70 bg-cyan-500/5'
                          : 'border-dashed border-primary/50'
                      }`}
                    >
                      {/* Biometric Corner Brackets */}
                      <div
                        className={`absolute -top-1.5 -left-1.5 size-5 border-t-3 border-l-3 rounded-tl-lg ${
                          currentMatch?.isConfidentMatch
                            ? 'border-ok'
                            : isScanPaused
                            ? 'border-amber-500'
                            : 'border-primary'
                        }`}
                      />
                      <div
                        className={`absolute -top-1.5 -right-1.5 size-5 border-t-3 border-r-3 rounded-tr-lg ${
                          currentMatch?.isConfidentMatch
                            ? 'border-ok'
                            : isScanPaused
                            ? 'border-amber-500'
                            : 'border-primary'
                        }`}
                      />
                      <div
                        className={`absolute -bottom-1.5 -left-1.5 size-5 border-b-3 border-l-3 rounded-bl-lg ${
                          currentMatch?.isConfidentMatch
                            ? 'border-ok'
                            : isScanPaused
                            ? 'border-amber-500'
                            : 'border-primary'
                        }`}
                      />
                      <div
                        className={`absolute -bottom-1.5 -right-1.5 size-5 border-b-3 border-r-3 rounded-br-lg ${
                          currentMatch?.isConfidentMatch
                            ? 'border-ok'
                            : isScanPaused
                            ? 'border-amber-500'
                            : 'border-primary'
                        }`}
                      />

                      {/* Animated Laser Scanning Line — Only active when scanning is LIVE */}
                      {!isScanPaused && cooldownCountdown === null && !currentMatch?.isConfidentMatch && (
                        <div className="absolute inset-x-2 h-0.5 bg-linear-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_var(--primary)] animate-[bounce_2s_infinite]" />
                      )}

                      {/* Status indicator inside reticle */}
                      {isMatchingFace ? (
                        <div className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-mono flex items-center gap-1.5 animate-pulse">
                          <Sparkles className="size-3 text-primary animate-spin" />
                          Matching Descriptor...
                        </div>
                      ) : currentMatch?.isConfidentMatch ? (
                        <div className="px-3 py-1 rounded-full bg-ok/90 backdrop-blur-md text-white text-[10px] font-mono flex items-center gap-1.5 font-bold shadow-sm">
                          <CheckCircle2 className="size-3.5" />
                          Face Identified!
                        </div>
                      ) : cooldownCountdown !== null ? (
                        <div className="px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-[10px] font-mono flex items-center gap-1.5 font-semibold pointer-events-auto">
                          <span>Check-in recorded! Resuming in {cooldownCountdown}s</span>
                          <button
                            type="button"
                            onClick={handleResumeScan}
                            className="underline text-white font-bold ml-1 hover:text-cyan-300"
                          >
                            Resume Now
                          </button>
                        </div>
                      ) : isScanPaused ? (
                        <div className="px-3 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-200 text-[10px] font-mono flex items-center gap-1.5 font-semibold pointer-events-auto">
                          <Pause className="size-3 text-amber-400" />
                          <span>Scan Paused</span>
                          <button
                            type="button"
                            onClick={handleResumeScan}
                            className="underline text-white font-bold ml-1 hover:text-amber-300"
                          >
                            Resume
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {/* Bottom HUD Hint */}
                    <div className="text-center">
                      <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/80 text-[11px] font-medium border border-white/10">
                        {currentMatch?.isConfidentMatch
                          ? 'Match found! Click Confirm Check-In below'
                          : isScanPaused
                          ? 'Scanner is paused. Click Resume Scan when ready.'
                          : cooldownCountdown !== null
                          ? 'Terminal in cooldown. Next athlete can step forward.'
                          : 'Align member face inside the reticle'}
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
                      {cameraError ? 'Camera Access Required' : 'Face Scanner is Stopped'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cameraError || 'Camera is turned off. Start the camera to resume live biometric face check-in.'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={startWebcam}
                    className="bg-primary text-primary-foreground font-bold text-xs gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Camera className="size-3.5" /> Start Camera &amp; Face Scan
                  </Button>
                </div>
              )}
            </div>

            {/* Confident Face Match Card: Displays Name, Photo, Status, and Check-In Button */}
            {currentMatch && currentMatch.isConfidentMatch && (
              <div className="p-4 rounded-xl border-2 border-ok/50 bg-ok/10 text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-200 shadow-md">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Member Photo */}
                  <div className="size-14 rounded-full border-2 border-ok overflow-hidden shrink-0 bg-secondary shadow-sm">
                    {currentMatch.member.photoUrl ? (
                      <img
                        src={currentMatch.member.photoUrl}
                        alt={currentMatch.member.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full bg-secondary flex items-center justify-center font-bold text-base text-muted-foreground">
                        {currentMatch.member.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Member Name & Status */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-base text-foreground truncate">
                        {currentMatch.member.name}
                      </span>
                      <Badge
                        variant={currentMatch.member.status === 'ACTIVE' ? 'default' : 'destructive'}
                        className="text-[10px] uppercase font-bold"
                      >
                        {currentMatch.member.status || 'ACTIVE'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mt-0.5 flex-wrap">
                      <span>{currentMatch.member.memberCode}</span>
                      {currentMatch.member.phone && <span>· +91 {currentMatch.member.phone}</span>}
                    </div>

                    {/* Biometric Match Metrics */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px] font-mono bg-ok/20 text-ok border-ok/40">
                        {currentMatch.confidence}% Match (Distance: {currentMatch.distance})
                      </Badge>
                      {currentMatch.member.planName && (
                        <span className="text-[11px] text-muted-foreground">
                          Plan: {currentMatch.member.planName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Check-in Button */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentMatch(null)}
                    className="h-9 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Scan Again
                  </Button>
                  <Button
                    type="button"
                    size="default"
                    disabled={isCheckingIn}
                    onClick={handleConfirmFaceCheckIn}
                    className="bg-ok hover:bg-ok/90 text-white font-bold text-sm shadow-md gap-2 h-10 px-5 cursor-pointer"
                  >
                    <UserCheck className="size-4" />
                    {isCheckingIn ? 'Recording...' : 'Confirm Check-In'}
                  </Button>
                </div>
              </div>
            )}

            {/* Unrecognized / Non-confident face detected hint */}
            {noMatchDetected && !currentMatch?.isConfidentMatch && (
              <div className="p-3 rounded-lg border border-warn/30 bg-warn/10 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-foreground">
                  <UserX className="size-4 text-warn shrink-0" />
                  <span>Face not recognized or similarity below threshold.</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => switchToManualSearch()}
                  className="text-xs h-7 border-warn/40 text-foreground hover:bg-warn/20"
                >
                  Search Manually
                </Button>
              </div>
            )}

            {/* Face ID Controls Strip with Prominent Stop / Pause Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{enrolledCount}</span> registered member
                biometric descriptors loaded.
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {cameraActive ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleStopCamera}
                      className="h-9 px-3.5 text-xs font-bold gap-1.5 bg-destructive hover:bg-destructive/90 text-white shadow-sm cursor-pointer"
                    >
                      <VideoOff className="size-4" />
                      Stop Face Detection
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={isScanPaused ? handleResumeScan : handlePauseScan}
                      className="h-8 text-xs font-semibold gap-1.5 border-border cursor-pointer"
                    >
                      {isScanPaused ? (
                        <>
                          <Play className="size-3.5 text-emerald-500" />
                          Resume Scan
                        </>
                      ) : (
                        <>
                          <Pause className="size-3.5 text-amber-500" />
                          Pause Scan
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={performFaceScan}
                      disabled={isMatchingFace || isCheckingIn}
                      className="h-8 text-xs font-semibold gap-1.5 border-border cursor-pointer"
                    >
                      <RefreshCw className={`size-3.5 ${isMatchingFace ? 'animate-spin' : ''}`} />
                      Scan Once
                    </Button>

                    <Button
                      type="button"
                      variant={autoScanEnabled && !isScanPaused ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (isScanPaused) setIsScanPaused(false);
                        setAutoScanEnabled(!autoScanEnabled);
                      }}
                      className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <Zap className="size-3.5" />
                      {autoScanEnabled && !isScanPaused ? 'Auto-Scan ON' : 'Auto-Scan OFF'}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={startWebcam}
                    className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground cursor-pointer"
                  >
                    <Camera className="size-3.5" />
                    Start Camera &amp; Scan
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => switchToManualSearch()}
                  className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                >
                  <Search className="size-3.5" />
                  Manual Search
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
