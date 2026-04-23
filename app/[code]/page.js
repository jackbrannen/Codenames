"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { pick25Words } from "../../lib/words"

const BG = "#C0B298"
const TAN = "#C4924A"
const RED_COLOR = "#CC2222"
const BLUE_COLOR = "#1E50B5"
const RED_BG = "rgba(204,34,34,0.18)"
const BLUE_BG = "rgba(30,80,181,0.18)"
const YELLOW = "#FBDF54"

function loadProfile() {
  try {
    const local = JSON.parse(localStorage.getItem("jackgames:profile") || "null")
    if (local?.firstName && local?.lastName) return local
    const match = document.cookie.match(/(?:^|;\s*)jackgames_profile=([^;]*)/)
    if (match) return JSON.parse(decodeURIComponent(match[1]))
  } catch {}
  return null
}

function saveProfile(profile) {
  const json = JSON.stringify(profile)
  localStorage.setItem("jackgames:profile", json)
  document.cookie = `jackgames_profile=${encodeURIComponent(json)}; domain=.jackbrannen.com; max-age=31536000; path=/; SameSite=Lax`
}

const TEXT = "#1A1008"

const inputStyle = {
  background: "rgba(0,0,0,0.1)",
  color: TEXT,
  fontSize: 20,
  padding: "16px 18px",
  width: "100%",
  display: "block",
  border: "none",
  outline: "none",
  boxSizing: "border-box",
}

const selectStyle = {
  background: "rgba(0,0,0,0.12)",
  color: TEXT,
  fontSize: 16,
  padding: "8px 12px",
  border: "1px solid rgba(0,0,0,0.2)",
}

function CogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export default function Lobby({ params }) {
  const router = useRouter()
  const code = useMemo(() => params.code.toUpperCase(), [params.code])

  const [gameExists, setGameExists] = useState(null)
  const [gamePhase, setGamePhase] = useState("lobby")
  const [firstTurnTeam, setFirstTurnTeam] = useState("red")
  const [lastUsedWords, setLastUsedWords] = useState([])
  const [players, setPlayers] = useState([])
  const [myPlayerId, setMyPlayerId] = useState(null)
  const [savedProfile, setSavedProfile] = useState(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [name, setName] = useState("")
  const [joinError, setJoinError] = useState("")
  const [joining, setJoining] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [draftFirstTurn, setDraftFirstTurn] = useState("red")

  async function refreshPlayers() {
    const { data } = await supabase
      .from("codenames_players")
      .select("id,name,team,is_cluegiver,ready,created_at")
      .eq("game_code", code)
      .order("created_at", { ascending: true })
    setPlayers(data ?? [])
  }

  async function loadGame() {
    const { data, error } = await supabase
      .from("codenames_games")
      .select("code,phase,first_turn_team,last_used_words")
      .eq("code", code)
      .single()
    if (error || !data) { setGameExists(false); return }
    setGameExists(true)
    setGamePhase(data.phase || "lobby")
    setFirstTurnTeam(data.first_turn_team || "red")
    setLastUsedWords(data.last_used_words || [])
  }

  useEffect(() => {
    const saved = loadProfile()
    if (saved) {
      saveProfile(saved)
      setSavedProfile(saved)
      setName(saved.username || "")
    }
  }, [])

  useEffect(() => {
    const existing = localStorage.getItem(`codenames:${code}:playerId`)
    if (existing) setMyPlayerId(existing)

    loadGame().then(() => refreshPlayers())
  }, [code])

  useEffect(() => {
    const poll = setInterval(async () => {
      await refreshPlayers()
      const { data } = await supabase
        .from("codenames_games")
        .select("phase,first_turn_team,last_used_words")
        .eq("code", code)
        .single()
      if (data) {
        setGamePhase(data.phase || "lobby")
        setFirstTurnTeam(data.first_turn_team || "red")
        setLastUsedWords(data.last_used_words || [])
      }
    }, 1500)

    return () => clearInterval(poll)
  }, [code])

  useEffect(() => {
    if (gamePhase === "play") router.replace(`/${code}/play`)
  }, [gamePhase])

  async function join() {
    const trimmed = name.trim()
    if (!trimmed || joining) return
    const trimmedFirst = (savedProfile?.firstName || firstName).trim()
    const trimmedLast = (savedProfile?.lastName || lastName).trim()
    if (!trimmedFirst || !trimmedLast) return

    setJoining(true)
    setJoinError("")

    const { data: existing } = await supabase
      .from("codenames_players")
      .select("id")
      .eq("game_code", code)
      .ilike("name", trimmed)
      .limit(1)
    if (existing?.length > 0) {
      setJoinError("That name is already taken. Please choose another.")
      setJoining(false)
      return
    }

    const newProfile = { firstName: trimmedFirst, lastName: trimmedLast, username: trimmed }
    saveProfile(newProfile)
    setSavedProfile(newProfile)

    const { data, error } = await supabase
      .from("codenames_players")
      .insert({ game_code: code, name: trimmed, first_name: trimmedFirst, last_name: trimmedLast })
      .select("id")
      .single()

    if (error) { alert("Failed to join: " + error.message); setJoining(false); return }

    localStorage.setItem(`codenames:${code}:playerId`, data.id)
    setMyPlayerId(data.id)
    setJoining(false)
    await refreshPlayers()
  }

  async function switchTeams() {
    if (!me) return
    const newTeam = me.team === "red" ? "blue" : me.team === "blue" ? "red" : "red"
    await supabase
      .from("codenames_players")
      .update({ team: newTeam, is_cluegiver: false, ready: false })
      .eq("id", me.id)
    await refreshPlayers()
  }

  async function joinTeam(team) {
    if (!me || me.team) return
    await supabase
      .from("codenames_players")
      .update({ team, ready: false })
      .eq("id", me.id)
    await refreshPlayers()
  }

  async function toggleCluegiver(playerId) {
    const target = players.find(p => p.id === playerId)
    if (!target || !me || target.team !== me.team) return
    await supabase.rpc("set_codenames_cluegiver", {
      p_code: code,
      p_player_id: playerId,
      p_is_cluegiver: !target.is_cluegiver,
    })
    await refreshPlayers()
  }

  async function toggleReady() {
    if (!me) return
    const { error } = await supabase
      .from("codenames_players")
      .update({ ready: !me.ready })
      .eq("id", me.id)
    if (error) { alert("Error: " + error.message); return }
    await refreshPlayers()
  }

  async function saveSettings() {
    await supabase
      .from("codenames_games")
      .update({ first_turn_team: draftFirstTurn })
      .eq("code", code)
    setFirstTurnTeam(draftFirstTurn)
    setShowSettings(false)
  }

  async function startGame() {
    const words = pick25Words(lastUsedWords)
    const { error } = await supabase.rpc("start_codenames_game", { p_code: code, p_words: words })
    if (error) { alert("Start failed: " + error.message); return }
    router.push(`/${code}/play`)
  }

  const me = players.find(p => p.id === myPlayerId)
  const redTeam = players.filter(p => p.team === "red")
  const blueTeam = players.filter(p => p.team === "blue")
  const redCluegiver = redTeam.find(p => p.is_cluegiver)
  const blueCluegiver = blueTeam.find(p => p.is_cluegiver)
  const everyoneReady = players.filter(p => p.team).length > 0 &&
    players.filter(p => p.team).every(p => p.ready)
  const canStart = gameExists === true &&
    redTeam.length >= 2 && blueTeam.length >= 2 &&
    !!redCluegiver && !!blueCluegiver && everyoneReady

  const myTeamCluegiver = me?.team === "red" ? redCluegiver : me?.team === "blue" ? blueCluegiver : null
  const myTeamSize = me?.team === "red" ? redTeam.length : me?.team === "blue" ? blueTeam.length : 0
  const otherTeamSize = me?.team === "red" ? blueTeam.length : me?.team === "blue" ? redTeam.length : 0
  const canReady = !!me?.team && !!myTeamCluegiver && myTeamSize >= 2 && otherTeamSize >= 2

  if (gameExists === null) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(0,0,0,0.4)", fontSize: 18, fontWeight: 700 }}>Loading…</p>
      </div>
    )
  }

  if (!gameExists) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ color: TEXT, fontSize: 24, fontWeight: 900, textTransform: "uppercase" }}>Game not found.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: "max(48px, calc(48px + env(safe-area-inset-bottom, 0px)))" }}>

      {/* Header */}
      <div style={{ padding: "28px 24px 24px", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", opacity: 0.45, marginBottom: 4 }}>
            Codenames
          </div>
          <div style={{ fontSize: "clamp(18px, 6vw, 38px)", fontWeight: 900, letterSpacing: "-1px", lineHeight: 1, whiteSpace: "nowrap" }}>
            {code}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 4 }}>
          {!!me && (
            <button
              onClick={() => { setDraftFirstTurn(firstTurnTeam); setShowSettings(s => !s) }}
              style={{ background: "rgba(0,0,0,0.1)", color: TEXT, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <CogIcon />
            </button>
          )}
          <button
            onClick={async () => {
              const url = window.location.href
              if (navigator.share) await navigator.share({ title: `Join Codenames — ${code}`, url })
              else { await navigator.clipboard.writeText(url); alert("Link copied!") }
            }}
            style={{ background: "rgba(0,0,0,0.1)", color: TEXT, fontSize: 13, fontWeight: 800, padding: "10px 16px" }}
          >
            Invite
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ padding: "20px 24px", background: "rgba(0,0,0,0.35)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Settings</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(0,0,0,0.75)" }}>First Turn</span>
            <select
              value={draftFirstTurn}
              onChange={e => setDraftFirstTurn(e.target.value)}
              style={selectStyle}
            >
              <option value="red">Red</option>
              <option value="blue">Blue</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={saveSettings}
              style={{ background: TAN, color: "#000", fontSize: 16, fontWeight: 900, padding: "12px 20px", flex: 1 }}
            >
              Save
            </button>
            <button
              onClick={() => setShowSettings(false)}
              style={{ background: "rgba(0,0,0,0.1)", color: TEXT, fontSize: 16, fontWeight: 800, padding: "12px 20px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Start Game CTA */}
      {canStart && (
        <div style={{ padding: "20px 24px", background: TAN }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
            Everyone is ready!
          </div>
          <button
            onClick={startGame}
            style={{ background: "#000", color: TAN, fontSize: 24, fontWeight: 900, padding: "20px", width: "100%", display: "block" }}
          >
            Start Game
          </button>
        </div>
      )}

      {/* Teams */}
      <div style={{ padding: "28px 24px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(0,0,0,0.4)", marginBottom: 14 }}>
          Teams
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { team: "red", color: RED_COLOR, bg: RED_BG, label: "Red", players: redTeam, cluegiver: redCluegiver },
            { team: "blue", color: BLUE_COLOR, bg: BLUE_BG, label: "Blue", players: blueTeam, cluegiver: blueCluegiver },
          ].map(({ team, color, bg, label, players: teamPlayers, cluegiver: teamCluegiver }) => (
            <div key={team} style={{ background: bg, padding: "12px 12px 12px", borderTop: `3px solid ${color}` }}>

              {/* Colored team label */}
              <div style={{ background: color, color: "white", fontSize: 11, fontWeight: 900, padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.1em", display: "inline-block", marginBottom: 8 }}>
                {label}
              </div>

              {/* Cluegiver indicator */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.45)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Spy: <span style={{ fontStyle: teamCluegiver ? "normal" : "italic", fontWeight: teamCluegiver ? 800 : 600 }}>{teamCluegiver?.name ?? "none"}</span>
              </div>

              {teamPlayers.length === 0 && (
                <div style={{ fontSize: 13, opacity: 0.35, fontStyle: "italic" }}>No players</div>
              )}

              {teamPlayers.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                    {p.id === myPlayerId && <span style={{ opacity: 0.4, fontSize: 11, fontWeight: 600 }}> you</span>}
                  </span>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.ready ? "#12BAAA" : "rgba(0,0,0,0.18)", flexShrink: 0 }} />
                  {me?.team === team && (
                    <button
                      onClick={() => toggleCluegiver(p.id)}
                      style={{
                        background: p.is_cluegiver ? color : "rgba(0,0,0,0.1)",
                        color: p.is_cluegiver ? "white" : "rgba(0,0,0,0.4)",
                        fontSize: 9, fontWeight: 900,
                        padding: "3px 6px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        flexShrink: 0,
                      }}
                    >
                      Spy
                    </button>
                  )}
                </div>
              ))}

              {/* Join button — full width, prominent */}
              {me && !me.team && (
                <button
                  onClick={() => joinTeam(team)}
                  style={{ background: color, color: "white", fontSize: 16, fontWeight: 900, padding: "14px", width: "100%", marginTop: 12, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}
                >
                  Join {label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Join / My Info */}
      <div style={{ padding: "28px 24px 0" }}>
        {!me ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(0,0,0,0.4)", marginBottom: 14 }}>
              Join Game
            </div>
            {!savedProfile && (
              <>
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="First name"
                  maxLength={40}
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Last name"
                  maxLength={40}
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
              </>
            )}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && join()}
              placeholder="Display Name"
              maxLength={45}
              style={inputStyle}
            />
            <button
              onClick={join}
              disabled={!name.trim() || (!savedProfile && (!firstName.trim() || !lastName.trim())) || joining}
              style={{ background: TAN, color: "#000", fontSize: 20, fontWeight: 900, padding: "18px", width: "100%", marginTop: 8, display: "block" }}
            >
              {joining ? "Joining…" : "Join"}
            </button>
            {joinError && (
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F04F52", marginTop: 10 }}>
                {joinError}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(0,0,0,0.4)", marginBottom: 14 }}>
              You
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
              {me.name}
              {me.team && (
                <span style={{ background: me.team === "red" ? RED_COLOR : BLUE_COLOR, color: "white", fontSize: 12, fontWeight: 900, padding: "3px 8px", marginLeft: 10, verticalAlign: "middle" }}>
                  {me.team === "red" ? "Red" : "Blue"}
                  {me.is_cluegiver && " · Spy"}
                </span>
              )}
            </div>

            {!me.team && (
              <p style={{ fontSize: 14, opacity: 0.55, marginBottom: 12, fontWeight: 600 }}>
                Pick a team above to get started.
              </p>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {me.team && (
                <button
                  disabled={me.ready}
                  onClick={switchTeams}
                  style={{ background: "rgba(0,0,0,0.1)", color: TEXT, fontSize: 14, fontWeight: 800, padding: "12px 18px" }}
                >
                  Switch Teams
                </button>
              )}

              {me.team && (
                <button
                  disabled={!canReady && !me.ready}
                  onClick={toggleReady}
                  style={{
                    background: me.ready ? "#12BAAA" : TAN,
                    color: me.ready ? "white" : "#000",
                    fontSize: 14,
                    fontWeight: 900,
                    padding: "12px 18px",
                  }}
                >
                  {me.ready ? "Not Ready" : "I'm Ready"}
                </button>
              )}
            </div>

            {me.team && !me.ready && !canReady && (
              <p style={{ marginTop: 12, fontSize: 13, opacity: 0.55, fontWeight: 600, color: TAN }}>
                {!myTeamCluegiver
                  ? "Your team needs a cluegiver before you can ready up."
                  : myTeamSize < 2
                  ? "Your team needs at least 2 players."
                  : "The other team needs at least 2 players."}
              </p>
            )}
          </>
        )}
      </div>

    </div>
  )
}
