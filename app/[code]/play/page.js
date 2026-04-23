"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabase"

const BG = "#1C1305"
const TAN = "#C4924A"
const RED_COLOR = "#CC2222"
const BLUE_COLOR = "#1E50B5"
const CARD_CREAM = "#F0E6CC"

// Muted tints for cluegiver's unrevealed view
const RED_MUTED    = "#E8A0A0"
const BLUE_MUTED   = "#9DB8E8"
const BLACK_MUTED  = "#999999"
const TAN_MUTED    = "#DDD0B0"

// Revealed colors (shown to everyone)
const RED_FULL     = "#CC2222"
const BLUE_FULL    = "#1E50B5"
const BLACK_FULL   = "#111111"
const TAN_FULL     = "#C4924A"

function cardBg(card, isCluegiver) {
  if (card.revealed) {
    if (card.color === "red")   return RED_FULL
    if (card.color === "blue")  return BLUE_FULL
    if (card.color === "black") return BLACK_FULL
    return TAN_FULL
  }
  if (isCluegiver) {
    if (card.color === "red")   return RED_MUTED
    if (card.color === "blue")  return BLUE_MUTED
    if (card.color === "black") return BLACK_MUTED
    return TAN_MUTED
  }
  return CARD_CREAM
}

function cardText(card, isCluegiver) {
  if (card.revealed) {
    if (card.color === "black") return "rgba(255,255,255,0.75)"
    return "white"
  }
  if (isCluegiver) {
    if (card.color === "black") return "rgba(255,255,255,0.9)"
    return "rgba(0,0,0,0.7)"
  }
  return "#2A1A08"
}

function teamColor(team) {
  return team === "red" ? RED_COLOR : BLUE_COLOR
}

function teamLabel(team) {
  return team === "red" ? "Red" : "Blue"
}

export default function Play({ params }) {
  const router = useRouter()
  const code = useMemo(() => params.code.toUpperCase(), [params.code])

  const [game, setGame] = useState(null)
  const [players, setPlayers] = useState([])
  const [cards, setCards] = useState([])
  const [myPlayerId, setMyPlayerId] = useState(null)
  const [clueWord, setClueWord] = useState("")
  const [clueNum, setClueNum] = useState(null)
  const [submittingClue, setSubmittingClue] = useState(false)
  const [submittingGuess, setSubmittingGuess] = useState(false)
  const loadEpochRef = useRef(0)

  async function loadState() {
    const epoch = ++loadEpochRef.current

    const [{ data: gameData }, { data: playerData }, { data: cardData }] = await Promise.all([
      supabase.from("codenames_games")
        .select("code,phase,turn_team,turn_phase,current_clue_word,current_clue_number,guesses_used,first_turn_team,winning_team,turn_selected_card_id")
        .eq("code", code)
        .single(),
      supabase.from("codenames_players")
        .select("id,name,team,is_cluegiver,ready")
        .eq("game_code", code)
        .order("created_at", { ascending: true }),
      supabase.from("codenames_cards")
        .select("id,word,position,color,revealed")
        .eq("game_code", code)
        .order("position", { ascending: true }),
    ])

    if (epoch !== loadEpochRef.current) return
    if (gameData) setGame(gameData)
    if (playerData) setPlayers(playerData)
    if (cardData) setCards(cardData)
  }

  useEffect(() => {
    const existing = localStorage.getItem(`codenames:${code}:playerId`)
    if (existing) setMyPlayerId(existing)
  }, [code])

  useEffect(() => {
    loadState()
    const poll = setInterval(loadState, 1500)
    return () => clearInterval(poll)
  }, [code])

  useEffect(() => {
    if (game?.phase === "lobby") router.replace(`/${code}`)
  }, [game?.phase])

  const me = players.find(p => p.id === myPlayerId)
  const isCluegiver = !!me?.is_cluegiver
  const myTeam = me?.team
  const isMyTurn = !!myTeam && game?.turn_team === myTeam
  const allGuessesUsed = game?.turn_phase === "guess" &&
    game?.current_clue_number != null &&
    (game?.guesses_used ?? 0) >= game.current_clue_number + 1

  // Counts of un-revealed cards per team
  const redLeft  = cards.filter(c => c.color === "red"  && !c.revealed).length
  const blueLeft = cards.filter(c => c.color === "blue" && !c.revealed).length

  async function selectCard(cardId) {
    if (!isMyTurn || isCluegiver || game?.turn_phase !== "guess" || allGuessesUsed) return
    await supabase
      .from("codenames_games")
      .update({ turn_selected_card_id: cardId })
      .eq("code", code)
    setGame(g => g ? { ...g, turn_selected_card_id: cardId } : g)
  }

  async function submitClue() {
    const word = clueWord.trim()
    if (!word || !clueNum || submittingClue) return
    setSubmittingClue(true)
    await supabase.rpc("submit_codenames_clue", {
      p_code: code,
      p_player_id: myPlayerId,
      p_word: word.toUpperCase(),
      p_number: clueNum,
    })
    setClueWord("")
    setClueNum(null)
    setSubmittingClue(false)
    await loadState()
  }

  async function submitGuess() {
    if (!game?.turn_selected_card_id || submittingGuess) return
    setSubmittingGuess(true)
    await supabase.rpc("submit_codenames_guess", {
      p_code: code,
      p_player_id: myPlayerId,
    })
    setSubmittingGuess(false)
    await loadState()
  }

  async function endTurn() {
    await supabase.rpc("end_codenames_turn", {
      p_code: code,
      p_player_id: myPlayerId,
    })
    await loadState()
  }

  async function playAgain() {
    await supabase.rpc("reset_codenames_game", { p_code: code })
    router.replace(`/${code}`)
  }

  if (!game) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, fontWeight: 700 }}>Loading…</p>
      </div>
    )
  }

  const winnerColor = game.winning_team === "red" ? RED_COLOR : BLUE_COLOR
  const turnColor = teamColor(game.turn_team)

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: "white", display: "flex", flexDirection: "column" }}>

      {/* Header bar */}
      <div style={{ background: "rgba(0,0,0,0.4)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {game.phase === "finished" ? (
          <div style={{ flex: 1, fontSize: 22, fontWeight: 900, color: winnerColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {teamLabel(game.winning_team)} Wins!
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: turnColor, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
              {teamLabel(game.turn_team)}'s Turn
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
              Needed:
              <span style={{ color: RED_COLOR, marginLeft: 6 }}>Red {redLeft}</span>
              <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 4px" }}>·</span>
              <span style={{ color: BLUE_COLOR }}>Blue {blueLeft}</span>
            </div>
          </div>
        )}
        {isCluegiver && game.phase === "play" && (
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: myTeam === "red" ? RED_COLOR : BLUE_COLOR, flexShrink: 0 }}>
            Cluegiver
          </div>
        )}
      </div>

      {/* Active clue display (during guess phase) */}
      {game.phase === "play" && game.turn_phase === "guess" && (
        <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.25)", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.05em", color: turnColor }}>
            {game.current_clue_word}
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.5)", marginLeft: 10 }}>
            {game.current_clue_number}
          </span>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
            {allGuessesUsed
              ? "All guesses used"
              : `Guesses used: ${game.guesses_used} / ${game.current_clue_number + 1}`}
          </div>
        </div>
      )}

      {/* Game board */}
      <div style={{ padding: "12px", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
          {cards.map(card => {
            const isSelected = card.id === game.turn_selected_card_id
            const canTap = !card.revealed &&
              game.phase === "play" &&
              game.turn_phase === "guess" &&
              isMyTurn &&
              !isCluegiver &&
              !allGuessesUsed
            const bg = cardBg(card, isCluegiver)
            const textColor = cardText(card, isCluegiver)

            return (
              <div
                key={card.id}
                onClick={() => canTap && selectCard(card.id)}
                style={{
                  aspectRatio: "1",
                  background: bg,
                  color: textColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 3,
                  textAlign: "center",
                  fontSize: card.word.length > 9 ? 8 : card.word.length > 6 ? 10 : 12,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  lineHeight: 1.2,
                  cursor: canTap ? "pointer" : "default",
                  boxShadow: isSelected ? "0 0 0 3px white, 0 0 0 5px rgba(0,0,0,0.4)" : "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  transition: "box-shadow 0.1s",
                  opacity: card.revealed && !isCluegiver ? 0.8 : 1,
                  position: "relative",
                }}
              >
                {card.word}
                {/* Revealed overlay indicator for cluegiver */}
                {card.revealed && isCluegiver && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ fontSize: card.word.length > 9 ? 8 : 10, fontWeight: 900, color: "rgba(255,255,255,0.9)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      {card.word}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Action area */}
      <div style={{ padding: "0 16px 16px", flexShrink: 0 }}>

        {/* ---- GAME OVER ---- */}
        {game.phase === "finished" && (
          <div style={{ paddingTop: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 12 }}>
              {game.winning_team === myTeam ? "Your team won! 🎉" : myTeam ? "Your team lost." : "Game over."}
            </div>
            <button
              onClick={playAgain}
              style={{ background: TAN, color: "#000", fontSize: 20, fontWeight: 900, padding: "18px", width: "100%", display: "block" }}
            >
              Play Again
            </button>
          </div>
        )}

        {/* ---- CLUE PHASE ---- */}
        {game.phase === "play" && game.turn_phase === "clue" && (
          <>
            {isMyTurn && isCluegiver ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
                  Your Clue
                </div>
                <input
                  value={clueWord}
                  onChange={e => setClueWord(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                  onKeyDown={e => e.key === "Enter" && clueNum && submitClue()}
                  placeholder="One word…"
                  maxLength={30}
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: "white",
                    fontSize: 22,
                    fontWeight: 800,
                    padding: "14px 16px",
                    width: "100%",
                    display: "block",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    boxSizing: "border-box",
                    marginBottom: 10,
                  }}
                />
                <div style={{ display: "flex", gap: 6, marginBottom: 10, justifyContent: "space-between" }}>
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button
                      key={n}
                      onClick={() => setClueNum(n)}
                      style={{
                        flex: 1,
                        aspectRatio: "1",
                        background: clueNum === n ? turnColor : "rgba(255,255,255,0.12)",
                        color: clueNum === n ? "white" : "rgba(255,255,255,0.7)",
                        fontSize: 16,
                        fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  disabled={!clueWord.trim() || !clueNum || submittingClue}
                  onClick={submitClue}
                  style={{ background: turnColor, color: "white", fontSize: 20, fontWeight: 900, padding: "18px", width: "100%", display: "block" }}
                >
                  {submittingClue ? "Sending…" : "Give Clue"}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
                  Waiting for{" "}
                  <span style={{ color: turnColor, fontWeight: 900 }}>
                    {teamLabel(game.turn_team)}
                  </span>
                  {" "}cluegiver…
                </div>
              </div>
            )}
          </>
        )}

        {/* ---- GUESS PHASE ---- */}
        {game.phase === "play" && game.turn_phase === "guess" && (
          <>
            {isMyTurn && !isCluegiver ? (
              <div style={{ display: "flex", gap: 8 }}>
                {allGuessesUsed ? (
                  <button
                    onClick={endTurn}
                    style={{ background: turnColor, color: "white", fontSize: 18, fontWeight: 900, padding: "16px 24px", flex: 1 }}
                  >
                    End Turn
                  </button>
                ) : (
                  <>
                    <button
                      disabled={!game.turn_selected_card_id || submittingGuess}
                      onClick={submitGuess}
                      style={{ background: turnColor, color: "white", fontSize: 18, fontWeight: 900, padding: "16px 24px", flex: 1 }}
                    >
                      {submittingGuess ? "Revealing…" : "Submit Guess"}
                    </button>
                    <button
                      onClick={endTurn}
                      style={{ background: "rgba(255,255,255,0.12)", color: "white", fontSize: 16, fontWeight: 800, padding: "16px 20px", flexShrink: 0 }}
                    >
                      End Turn
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
                  {isMyTurn && isCluegiver
                    ? <><span style={{ color: turnColor, fontWeight: 900 }}>Your team</span> is guessing…</>
                    : <>Waiting for <span style={{ color: turnColor, fontWeight: 900 }}>{teamLabel(game.turn_team)}</span> to guess…</>
                  }
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
