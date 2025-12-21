"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

/* ---------------- TYPES ---------------- */
type Player = {
  user_id: string;
  is_host?: boolean;
  is_ready?: boolean;
  users?: {
    name: string;
  } | null;
  player_scores?: {
    total_score: number;
  } | null;
};


type PromptResult = {
  id: string;
  prompt_text: string;
  scores?: number;
  justification?: string;
  user_id: string;
  users?: {
    name: string;
  } | null;
};

type BattlePhase = "waiting" | "submission" | "results" | "finished";

/* ---------------- COMPONENT ---------------- */

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const roomId = typeof id === "string" ? id : null;

  const [players, setPlayers] = useState<Player[]>([]);
  const [battlePhase, setBattlePhase] = useState<BattlePhase>("waiting");

  // Game State
  const [timeLeft, setTimeLeft] = useState(60);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<PromptResult[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

  // User & Loading State
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingEval, setLoadingEval] = useState(false);
  const [showRoundIntro, setShowRoundIntro] = useState(false);
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [totalRounds, setTotalRounds] = useState<number>(3); // Default 3, fetches real count later
  const [isTransitioning, setIsTransitioning] = useState(false); // Fixes "Starting Round..." sticking

  // Timer State
  const [timerRoundId, setTimerRoundId] = useState<string | null>(null);
  const [nextRoundTimer, setNextRoundTimer] = useState<number | null>(null);

  const gameStarted = battlePhase === "submission" || battlePhase === "results";

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  /* ---------------- FETCH ROOM INFO ---------------- */
  useEffect(() => {
    if (!roomId) return;
    // Get total rounds so we know when to end the game
    supabase
      .from("rooms")
      .select("total_rounds")
      .eq("id", roomId)
      .single()
      .then(({ data }) => {
        if (data) setTotalRounds(data.total_rounds);
      });
  }, [roomId]);

  /* ---------------- LOAD PLAYERS ---------------- */
  const loadPlayers = async () => {
    if (!roomId || !userId) return;

    const { data } = await supabase
      .from("room_players")
      .select(`
        user_id,
        is_host,
        is_ready,
        users ( name ),
        player_scores ( total_score )
      `)
      .eq("room_id", roomId);

    setPlayers((data as Player[]) || []);
  };

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    if (!roomId || !userId) return;

    loadPlayers();

    const playersChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          await loadPlayers();
        }
      )
      .subscribe();

    const phaseChannel = supabase
      .channel(`room-phase-${roomId}`)
      /* ---- PHASE UPDATE (NEW ROUND) ---- */
      .on("broadcast", { event: "phase_update" }, (payload) => {
        setIsTransitioning(false); // Stop loader
        setBattlePhase("submission");
        setTimeLeft(payload.payload.time);
        setImageURL(payload.payload.image_url);

        setCurrentRoundId(payload.payload.round_id);
        setActiveRoundId(payload.payload.round_id);

        setResults([]);
        setPromptText("");
        setSubmitted(false);
        setNextRoundTimer(null);
        setTimerRoundId(null);

        setRoundNumber(payload.payload.round_number);
        setShowRoundIntro(true);
        setTimeout(() => setShowRoundIntro(false), 1500);
      })

      /* ---- RESULTS READY ---- */
      .on("broadcast", { event: "results_ready" }, async (payload) => {
        setLoadingEval(false);

        if (activeRoundId && payload.payload.round_id !== activeRoundId) {
          return;
        }

        await loadPlayers();

        const { data } = await supabase
          .from("prompts")
          .select(`
            id,
            prompt_text,
            scores,
            justification,
            user_id,
            users ( name )
          `)
          .eq("round_id", payload.payload.round_id)
          .order("scores", { ascending: false });

        setResults((data as PromptResult[]) || []);
        setBattlePhase("results");

        // ONLY start timer if rounds are left
        if (roundNumber && roundNumber < totalRounds) {
          if (timerRoundId !== payload.payload.round_id) {
            setTimerRoundId(payload.payload.round_id);
            setNextRoundTimer(15);
          }
        } else {
          setNextRoundTimer(null);
        }
      })

      /* ---- GAME FINISHED ---- */
      .on("broadcast", { event: "game_finished" }, async () => {
        setIsTransitioning(false); // Stop any loaders
        await loadPlayers();
        setBattlePhase("finished");
        setNextRoundTimer(null);
        setTimerRoundId(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(phaseChannel);
    };
  }, [roomId, userId, timerRoundId, activeRoundId, totalRounds]);

  /* ---------------- DERIVED STATE ---------------- */
  const me = players.find((p) => p.user_id === userId);
  const isHost = me?.is_host === true;
  const isReady = me?.is_ready === true;
  const nonHostPlayers = players.filter((p) => !p.is_host);
  const allPlayersReady =
    nonHostPlayers.length === 0 ||
    nonHostPlayers.every((p) => p.is_ready === true);
  const myResult = results.find((r) => r.user_id === userId);

  /* ---------------- GAME TIMER ---------------- */
  useEffect(() => {
    if (battlePhase !== "submission") return;
    setTimeLeft(60);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setLoadingEval(true);
          fetch("/api/battle/score-prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              room_id: roomId,
              round_id: currentRoundId,
              image_url: imageURL,
            }),
          }).catch(() => setLoadingEval(false));
          return 0;
        }
        return prev - 1;
      });
    }

    return;
  }

  const t = setTimeout(() => {
    setNextRoundTimer((v) => (v ? v - 1 : null));
  }, 1000);

  return () => clearTimeout(t);
}, [nextRoundTimer, isHost]);


  /* ---------------- NEXT ROUND TIMER ---------------- */
  useEffect(() => {
    if (nextRoundTimer === null) return;

    if (nextRoundTimer === 0) {
      setNextRoundTimer(null);
      setIsTransitioning(true); // START LOADING

      // Reset local UI
      setResults([]);
      setPromptText("");
      setSubmitted(false);
      setTimeLeft(0);
      setImageURL(null);
      setRoundNumber(null);

      // Anyone can trigger advance now (handled safely by backend)
      fetch("/api/battle/advance-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, user_id: userId }),
      }).catch(() => setIsTransitioning(false));

      return;
    }

    const t = setTimeout(() => {
      setNextRoundTimer((v) => (v ? v - 1 : null));
    }, 1000);

    return () => clearTimeout(t);
  }, [nextRoundTimer, roomId, userId]);

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] via-[#0E1320] to-[#0B0F14] text-gray-100">
      <div className="max-w-[1500px] mx-auto px-10 py-8 flex gap-10">
        
        {/* SIDEBAR */}
        <aside className="w-[300px] bg-[#111827]/90 backdrop-blur rounded-3xl border border-gray-800 p-6 shadow-2xl sticky top-8 h-fit">
          <h2 className="text-xl font-semibold mb-5 tracking-tight">
            Room Players
          </h2>
          {players.map((p) => (
            <div
              key={p.user_id}
              className="group flex items-center gap-4 px-4 py-3 rounded-2xl mb-2 bg-[#0F172A] hover:bg-[#141E33] transition-all duration-200 hover:scale-[1.02]"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-semibold shadow-md">
                {p.users?.name?.[0] || "P"}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {p.users?.name || "Player"}{" "}
                    {p.is_host && <span className="text-indigo-400">(host)</span>}
                  </span>
                  <span className="text-sm font-semibold text-indigo-300">
                    {p.player_scores?.total_score ?? 0}
                  </span>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      gameStarted
                        ? "bg-indigo-400"
                        : p.is_ready
                        ? "bg-green-400"
                        : "bg-gray-500"
                    }`}
                  />
                  {gameStarted ? "Playing" : p.is_ready ? "Ready" : "Waiting"}
                </div>
              </div>
            </div>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 bg-[#111827]/80 backdrop-blur rounded-3xl border border-gray-800 shadow-2xl p-12 flex flex-col items-center">
          
          {/* HERO TIMER (Only show if NOT finished and NOT Loading) */}
          {battlePhase !== "results" && battlePhase !== "finished" && !isTransitioning && (
            <div className="mb-8 text-center">
              <div className="text-7xl font-bold tracking-tight text-indigo-400 drop-shadow">
                {timeLeft}s
              </div>
              <p className="text-sm text-gray-400 mt-1">Time remaining</p>
            </div>
          )}

          {/* TRANSITION LOADER */}
          {isTransitioning && battlePhase !== "finished" && (
            <div className="flex flex-col items-center justify-center h-64 animate-pulse">
              <div className="text-2xl font-bold text-indigo-400">
                Starting Round {roundNumber ? roundNumber + 1 : "..."}
              </div>
              <p className="text-gray-500 mt-2">Generating new image...</p>
            </div>
          )}

          {/* IMAGE */}
          {imageURL && !isTransitioning && battlePhase !== "finished" && (
            <div className="bg-[#0F172A] rounded-3xl p-6 border border-gray-800 shadow-xl mb-8 transition-all duration-300 hover:scale-[1.01]">
              <img
                src={imageURL}
                alt="Round"
                className="rounded-2xl max-h-[420px] object-contain mx-auto"
              />
            </div>
          )}

          {/* WAITING PHASE */}
          {battlePhase === "waiting" && (
            <div className="flex flex-col items-center gap-6">
              {!isHost && (
                <Button
                  className="px-10 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all duration-200 hover:scale-[1.05]"
                  onClick={async () => {
                    if (!roomId || !userId) return;
                    await fetch("/api/room/ready", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        room_id: roomId,
                        user_id: userId,
                        is_ready: !isReady,
                      }),
                    });
                  }}
                >
                  {isReady ? "Unready" : "Ready Up"}
                </Button>
              )}

              {isHost && (
                <>
                  <Button
                    disabled={!allPlayersReady}
                    className="px-12 py-4 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-40 transition-all duration-200 hover:scale-[1.05]"
                    onClick={async () => {
                      if (!roomId || !userId) return;
                      await fetch("/api/battle/start", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ room_id: roomId, user_id: userId }),
                      });
                    }}
                  >
                    Start Round
                  </Button>
                  {!allPlayersReady && (
                    <p className="text-sm text-gray-400">
                      Waiting for participants to get ready…
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* SUBMISSION PHASE */}
          {battlePhase === "submission" && !isTransitioning && (
            <div className="w-full max-w-2xl flex flex-col gap-6">
              <textarea
                className="bg-[#0F172A] border border-gray-700 rounded-2xl p-6 text-base resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                placeholder="Write your prompt here..."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  disabled={!promptText || submitted}
                  className="px-10 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all duration-200 hover:scale-[1.05]"
                  onClick={() => {
                    setSubmitted(true);
                    fetch("/api/battle/submit-prompt", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        room_id: roomId,
                        round_id: currentRoundId,
                        user_id: userId,
                        prompt_text: promptText,
                      }),
                    });
                  }}
                >
                  {submitted ? "Locked ✔" : "Lock In Prompt"}
                </Button>
              </div>
            </div>
          )}

          {/* RESULTS PHASE */}
          {!loadingEval && results.length > 0 && battlePhase === "results" && (
            <div className="w-full max-w-xl animate-fade-in">
              <h2 className="text-4xl font-bold mb-8 text-center tracking-tight">
                Leaderboard
              </h2>
              {results.map((r, i) => (
                <div
                  key={r.id}
                  className={`grid grid-cols-[50px_1fr_100px] items-center px-8 py-5 rounded-2xl mb-4 transition-all duration-200 ${
                    i === 0
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-2xl scale-[1.02]"
                      : "bg-[#0F172A] hover:bg-[#141E33]"
                  }`}
                >
                  <span className="text-xl font-bold">{i + 1}</span>
                  <span className="text-lg">
                    {r.users?.name || "Player"} {i === 0 && "🏆"}
                  </span>
                  <span className="text-xl font-bold text-right">
                    {r.scores}
                  </span>
                </div>
              ))}

              {myResult && (
                <>
                  <h3 className="text-2xl font-semibold mt-8 mb-3">
                    AI Evaluation
                  </h3>
                  <div className="bg-[#0F172A] p-6 rounded-2xl shadow-inner border border-gray-800">
                    <p className="font-semibold text-lg text-indigo-300">
                      Score: {myResult.scores}
                    </p>
                    <p className="text-gray-300 mt-2 italic">
                      "{myResult.justification}"
                    </p>
                  </div>
                </>
              )}

              {/* Next Round Timer */}
              {nextRoundTimer !== null && (
                <div className="mt-10 text-center">
                  <p className="text-lg text-gray-400">Next round starts in</p>
                  <p className="text-5xl font-bold text-indigo-400 mt-2">
                    {nextRoundTimer}s
                  </p>
                </div>
              )}

              {/* View Final Podium Button (Only Last Round) */}
              {roundNumber === totalRounds && nextRoundTimer === null && (
                <div className="mt-10 text-center">
                  <Button
                    className="px-12 py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:scale-[1.05] text-white font-bold text-lg shadow-xl transition-all"
                    onClick={() => {
                      setIsTransitioning(true);
                      fetch("/api/battle/advance-round", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ room_id: roomId, user_id: userId }),
                      });
                    }}
                  >
                    View Final Podium 🏆
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* FINAL PODIUM (FINISHED PHASE) */}
          {battlePhase === "finished" && (
            <div className="w-full max-w-xl animate-fade-in">
              <h2 className="text-5xl font-extrabold mb-10 text-center tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                Final Podium 🏆
              </h2>
              {[...players]
                .sort(
                  (a, b) =>
                    (b.player_scores?.total_score ?? 0) -
                    (a.player_scores?.total_score ?? 0)
                )
                .map((p, i) => (
                  <div
                    key={p.user_id}
                    className={`flex justify-between items-center px-8 py-6 rounded-3xl mb-4 shadow-xl border border-white/5 ${
                      i === 0
                        ? "bg-gradient-to-r from-yellow-500 to-orange-600 scale-[1.05] z-10"
                        : i === 1
                        ? "bg-gray-700/80 scale-[1.02]"
                        : i === 2
                        ? "bg-amber-800/60 scale-[1.01]"
                        : "bg-[#0F172A]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-2xl font-bold ${
                          i === 0 ? "text-white" : "text-gray-400"
                        }`}
                      >
                        #{i + 1}
                      </span>
                      <span
                        className={`text-xl font-semibold ${
                          i === 0 ? "text-white" : "text-gray-200"
                        }`}
                      >
                        {p.users?.name}
                      </span>
                    </div>
                    <span
                      className={`text-3xl font-bold ${
                        i === 0 ? "text-white" : "text-gray-200"
                      }`}
                    >
                      {p.player_scores?.total_score ?? 0}
                    </span>
                  </div>
                ))}

              <div className="mt-12 text-center">
                <Button
                  onClick={() => router.push("/")}
                  className="px-8 py-3 rounded-xl bg-gray-700 hover:bg-gray-600"
                >
                  Return to Home
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    ))}

    {myResult && (
      <>
        <h3 className="text-2xl font-semibold mt-8 mb-3">
          AI Evaluation
        </h3>
        <div className="bg-[#0F172A] p-6 rounded-2xl shadow-inner">
          <p className="font-semibold text-lg">
            Score: {myResult.scores}
          </p>
          <p className="text-gray-300 mt-1">
            {myResult.justification}
          </p>
        </div>
      </>
    )}

    {/* 👇 TIMER GOES BELOW RESULTS */}
    {nextRoundTimer !== null && (
      <div className="mt-10 text-center">
        <p className="text-lg text-gray-400">
          Next round starts in
        </p>
        <p className="text-5xl font-bold text-indigo-400 mt-2">
          {nextRoundTimer}s
        </p>
      </div>
    )}
  </div>
)}

          {battlePhase === "finished" && (
  <div className="w-full max-w-xl">
    <h2 className="text-4xl font-bold mb-8 text-center tracking-tight">
      Final Leaderboard 🏆
    </h2>

    {[...players]
      .sort(
        (a, b) =>
          (b.player_scores?.total_score ?? 0) -
          (a.player_scores?.total_score ?? 0)
      )
      .map((p, i) => (
        <div
          key={p.user_id}
          className={`flex justify-between items-center px-8 py-5 rounded-2xl mb-4 ${
            i === 0
              ? "bg-gradient-to-r from-indigo-600 to-purple-600"
              : "bg-[#0F172A]"
          }`}
        >
          <span className="text-lg font-semibold">
            {i + 1}. {p.users?.name}
            {i === 0 && " 🥇"}
          </span>
          <span className="text-xl font-bold">
            {p.player_scores?.total_score ?? 0}
          </span>
        </div>
      ))}
  </div>
)}
        </main>
      </div>
      {loadingEval && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="bg-[#0F172A] border border-gray-700 rounded-3xl px-12 py-10 shadow-2xl flex flex-col items-center gap-6 animate-fade-in">
      
      {/* Spinner */}
      <div className="w-14 h-14 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />

      {/* Text */}
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight">
          Evaluating
        </p>
        <p className="text-sm text-gray-400 mt-1">
          AI is scoring prompts…
        </p>
      </div>
    </div>
  </div>
)}{roundNumber && (
  <div
    className={`
      fixed left-1/2 z-[200]
      transition-all duration-1000 ease-in-out
      ${showRoundIntro
        ? "top-1/2 -translate-x-1/2 -translate-y-1/2 scale-125 opacity-100"
        : "top-6 -translate-x-1/2 scale-90 opacity-80"}
    `}
  >
    <div className="px-10 py-5 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 shadow-2xl">
      <span className="text-4xl font-extrabold tracking-wide">
        ROUND {roundNumber}
      </span>
    </div>
  </div>
)}


      {/* EVALUATING OVERLAY */}
      {loadingEval && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-gray-700 rounded-3xl px-12 py-10 shadow-2xl flex flex-col items-center gap-6 animate-fade-in">
            <div className="w-14 h-14 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-2xl font-semibold tracking-tight">Evaluating</p>
              <p className="text-sm text-gray-400 mt-1">AI is scoring prompts…</p>
            </div>
          </div>
        </div>
      )}

      {/* ROUND INTRO POPUP */}
      {showRoundIntro && roundNumber && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] scale-125 opacity-100 transition-all duration-1000 ease-in-out">
          <div className="px-10 py-5 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 shadow-2xl">
            <span className="text-4xl font-extrabold tracking-wide">
              ROUND {roundNumber}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}