import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supa } from './lib/supa'

const STORAGE_KEY = 'escala_midia_rt_multiassign_v1'
const CONFIG_STORAGE_KEY = 'escala_midia_rt_multiassign_cfg_v1'

const t = {
  sundayFixed:'', language:'Idioma',
  members:'Membros', add:'Adicionar', remove:'Remover', addMemberPlaceholder:'Adicionar nome',
  teamConfig:'Equipes & Tarefas', addTeam:'Adicionar equipe', teamName:'Nome da equipe', roles:'Tarefas (separe por vírgula)',
  actions:'Ações', autofill:'Auto-preencher (round-robin) — equipe ativa', print:'Imprimir', copy:'Copiar resumo', exportXLSX:'Exportar XLSX',
  dates:'Datas específicas', pickSundays:'Selecionar todos os domingos do mês atual', weekday:'Dia da semana', select:'— Selecionar —',
  space:'Espaço', connect:'Conectar', linkReady:'Link copiado!', live:'Ao vivo', notConnected:'(sem Supabase)',
  rosterMemberTeams:'Equipes deste membro (Ctrl/Cmd p/ múltiplos)'
}
const WEEKDAY = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

function fmtDate(d){
  if (typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const dt = new Date(d)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`
}
function isSundayISO(iso){ const [y,m,d]=iso.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay()===0 }
function weekdayName(iso){ const [y,m,d]=iso.split('-').map(Number); return WEEKDAY[new Date(Date.UTC(y,m-1,d)).getUTCDay()] }

function buildTeamOptionGroups(teamId, members){
  const inTeam = members.filter(m=> Array.isArray(m.teams) && m.teams.includes(teamId)).map(m=> m.name)
  const others = members.filter(m=> !Array.isArray(m.teams) || !m.teams.includes(teamId)).map(m=> m.name)
  inTeam.sort((a,b)=> a.localeCompare(b, undefined, {sensitivity:'base'}))
  others.sort((a,b)=> a.localeCompare(b, undefined, {sensitivity:'base'}))
  return { inTeam, others }
}

function asArray(v){ if(!v) return []; return Array.isArray(v)? v.filter(Boolean) : (v===''? [] : [v]) }
function uniq(arr){ return Array.from(new Set(arr)) }

// Merge helpers
function mergeArraysByKey(localArr=[], remoteArr=[], key){
  const map = new Map()
  for(const it of localArr||[]) map.set(it[key], {...it})
  for(const it of remoteArr||[]) map.set(it[key], { ...(map.get(it[key])||{}), ...it })
  return Array.from(map.values())
}
function mergeScheduleDate(local={}, remote={}){
  const out = { ...(local||{}) }
  for(const iso of Object.keys(remote||{})){
    out[iso] = out[iso] || {}
    for(const teamId of Object.keys(remote[iso]||{})){
      out[iso][teamId] = out[iso][teamId] || {}
      for(const role of Object.keys(remote[iso][teamId]||{})){
        const r = asArray(remote[iso][teamId][role])
        const l = asArray(out[iso][teamId][role])
        out[iso][teamId][role] = uniq([...l, ...r]) // merge arrays
      }
    }
  }
  return out
}
function mergePayload(local, remote){
  const out = { ...(local||{}) }
  out.__rev = Math.max(remote?.__rev||0, local?.__rev||0)
  if(Array.isArray(remote.members)){
    const l = (local.members||[]).map(m=> typeof m==='string'? {name:m,teams:[]} : m)
    const r = remote.members.map(m=> typeof m==='string'? {name:m,teams:[]} : m)
    out.members = mergeArraysByKey(l, r, 'name')
  }
  if(Array.isArray(remote.teams)) out.teams = mergeArraysByKey(local.teams||[], remote.teams, 'id')
  if(Array.isArray(remote.selectedDates)){ const set = new Set([...(local.selectedDates||[]), ...remote.selectedDates]); out.selectedDates = Array.from(set).sort() }
  if(remote.scheduleDate) out.scheduleDate = mergeScheduleDate(local.scheduleDate||{}, remote.scheduleDate)
  if(remote.activeTeamId) out.activeTeamId = remote.activeTeamId
  return out
}

export default function App(){
  const [logo,setLogo] = useState('/logo.png')
  const [members,setMembers] = useState([{name:'Alice',teams:[]},{name:'Bruno',teams:[]},{name:'Camila',teams:[]}])
  const [newMember,setNewMember] = useState('')
  const [teams,setTeams] = useState([{ id:'team-1', name:'Mídia', roles:['Front','Livestream','Câmeras'] }])
  const [activeTeamId,setActiveTeamId] = useState('team-1')

  const [selectedDates, setSelectedDates] = useState([])
  const [scheduleDate, setScheduleDate] = useState({})

  const [spaceId, setSpaceId] = useState(import.meta.env.VITE_SPACE_ID || 'demo')
  const [status, setStatus] = useState('')

  // Robust sync refs
  const deb = useRef(null); const chRef = useRef(null)
  const applyTimerRef = useRef(null); const lastRemotePayloadRef = useRef(null); const APPLY_INTERVAL_MS = 5000
  const editingLockRef = useRef(false)
  const localRevRef = useRef(0)
  const pollRef = useRef(null)
  const suppressNext = useRef(false)

  // Load local
  useEffect(()=>{
    try{
      const cfg = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY)||'null'); if(cfg){ if(Array.isArray(cfg.members)) setMembers(cfg.members); if(Array.isArray(cfg.teams)) setTeams(cfg.teams) }
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(raw){ if(raw.logo) setLogo(raw.logo); if(Array.isArray(raw.members)) setMembers(raw.members); if(Array.isArray(raw.teams)) setTeams(raw.teams); if(Array.isArray(raw.selectedDates)) setSelectedDates(raw.selectedDates); if(raw.scheduleDate) setScheduleDate(raw.scheduleDate); if(raw.activeTeamId) setActiveTeamId(raw.activeTeamId); if(typeof raw.__rev==='number') localRevRef.current = raw.__rev }
    }catch{}
  },[])
  useEffect(()=> localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({members,teams})), [members,teams])
  useEffect(()=> localStorage.setItem(STORAGE_KEY, JSON.stringify({ logo, members, teams, selectedDates, scheduleDate, activeTeamId, __rev: localRevRef.current })), [logo,members,teams,selectedDates,scheduleDate,activeTeamId])

  // Cloud
  async function fetchCloud(id){
    if(!supa) return
    const { data } = await supa.from('state').select('payload').eq('id', id).single()
    if(data?.payload){
      const merged = mergePayload({ logo, members, teams, selectedDates, scheduleDate, activeTeamId, __rev: localRevRef.current }, data.payload)
      applyPayload(merged, true)
    }
  }
  function applyPayload(p, fromCloud=false){
    if(fromCloud && typeof p.__rev==='number' && p.__rev <= localRevRef.current) return
    if(typeof p.__rev==='number') localRevRef.current = p.__rev
    if(p.logo) setLogo(p.logo)
    if(Array.isArray(p.members)) setMembers(p.members)
    if(Array.isArray(p.teams)) setTeams(p.teams)
    if(Array.isArray(p.selectedDates)) setSelectedDates(p.selectedDates)
    if(p.scheduleDate) setScheduleDate(p.scheduleDate)
    if(p.activeTeamId) setActiveTeamId(p.activeTeamId)
    setStatus('Ao vivo')
  }
  function scheduleCloudSave(){
    if(!supa || !spaceId) return
    if(deb.current) clearTimeout(deb.current)
    deb.current = setTimeout(async ()=>{
      const payload = { logo, members, teams, selectedDates, scheduleDate, activeTeamId, __rev: (localRevRef.current + 1) }
      localRevRef.current = payload.__rev
      suppressNext.current = true
      await supa.from('state').upsert({ id: spaceId, payload }, { onConflict: 'id' })
      setTimeout(()=>{ suppressNext.current = false }, 3500)
    }, 1200)
  }
  useEffect(()=>{ scheduleCloudSave() }, [spaceId, logo, members, teams, selectedDates, scheduleDate, activeTeamId])

  function onRealtime(payload){
    if(suppressNext.current) return
    const row = payload?.new || payload?.record
    if(!row?.payload) return
    if(editingLockRef.current){ lastRemotePayloadRef.current = row.payload; return }
    lastRemotePayloadRef.current = row.payload
    if(applyTimerRef.current) return
    applyTimerRef.current = setTimeout(()=>{
      try{
        const merged = mergePayload({ logo, members, teams, selectedDates, scheduleDate, activeTeamId, __rev: localRevRef.current }, lastRemotePayloadRef.current)
        applyPayload(merged, true)
      } finally { lastRemotePayloadRef.current = null; applyTimerRef.current = null }
    }, APPLY_INTERVAL_MS)
  }

  useEffect(()=>{
    if(!supa || !spaceId) return
    if(chRef.current){ chRef.current.unsubscribe(); chRef.current = null }
    const ch = supa.channel('state_changes_'+spaceId)
      .on('postgres_changes', { event:'*', schema:'public', table:'state', filter:`id=eq.${spaceId}` }, onRealtime)
      .subscribe()
    chRef.current = ch
    fetchCloud(spaceId)
    return ()=>{ try{ if(applyTimerRef.current) clearTimeout(applyTimerRef.current) }catch{} ch.unsubscribe() }
  }, [spaceId])

  useEffect(()=>{
    const onFocusIn = (e)=>{
      const tag=(e.target?.tagName||'').toLowerCase(); if(['input','select','textarea'].includes(tag)) editingLockRef.current = true
    }
    const onFocusOut = ()=>{ setTimeout(()=>{ editingLockRef.current=false; if(lastRemotePayloadRef.current){ const merged = mergePayload({ logo, members, teams, selectedDates, scheduleDate, activeTeamId, __rev: localRevRef.current }, lastRemotePayloadRef.current); applyPayload(merged, true); lastRemotePayloadRef.current=null } }, 400) }
    window.addEventListener('focusin', onFocusIn); window.addEventListener('focusout', onFocusOut)
    return ()=>{ window.removeEventListener('focusin', onFocusIn); window.removeEventListener('focusout', onFocusOut) }
  }, [])

  useEffect(()=>{
    if(!supa || !spaceId) return
    if(pollRef.current){ clearInterval(pollRef.current); pollRef.current=null }
    pollRef.current = setInterval(()=>{ if(!editingLockRef.current) fetchCloud(spaceId) }, 60000)
    return ()=>{ if(pollRef.current) clearInterval(pollRef.current) }
  }, [spaceId])

  // UI helpers
  function onLogoUpload(file){ const r=new FileReader(); r.onload=()=>setLogo(String(r.result)); r.readAsDataURL(file) }
  function addMember(){ const n=newMember.trim(); if(!n) return; if(members.some(m=>m.name===n)){ alert('Esse nome já existe.'); return } setMembers([...members,{name:n,teams:[]}]); setNewMember('') }
  function removeMember(name){
    setMembers(members.filter(m=>m.name!==name))
    setScheduleDate(prev=>{ const c=structuredClone(prev); for(const iso of Object.keys(c)){ for(const teamId of Object.keys(c[iso]||{})){ for(const role of Object.keys(c[iso][teamId]||{})){ const arr=asArray(c[iso][teamId][role]); if(arr.includes(name)) c[iso][teamId][role]=arr.filter(x=>x!==name) } } } return c })
  }
  function addTeam(){ const id=`team-${Math.random().toString(36).slice(2,7)}`; setTeams([...teams,{ id, name:'Nova Equipe', roles:['Papel A','Papel B'] }]); setActiveTeamId(id) }
  function updateTeam(id, name, rolesCsv){ const roles=rolesCsv.split(',').map(s=>s.trim()).filter(Boolean); setTeams(teams.map(t=> t.id===id? { ...t, name, roles } : t)) }
  function removeTeam(id){ setTeams(teams.filter(t=>t.id!==id)); setScheduleDate(prev=>{ const c=structuredClone(prev); for(const iso of Object.keys(c)){ if(c[iso]&&c[iso][id]) delete c[iso][id] } return c }); if(activeTeamId===id){ const nxt=teams.find(t=>t.id!==id)?.id||null; setActiveTeamId(nxt) } }

  function removeAssigned(iso, teamId, role, name){
    setScheduleDate(prev=>{
      const c = structuredClone(prev); const arr = asArray(c[iso]?.[teamId]?.[role])
      const next = arr.filter(n=> n!==name)
      if(!c[iso]) c[iso]={}; if(!c[iso][teamId]) c[iso][teamId]={}
      c[iso][teamId][role] = next
      return c
    })
  }
  function assignDateAdd(iso, teamId, role, name){
    if(!name) return;
    setScheduleDate(prev=>{
      const c = structuredClone(prev)
      c[iso]=c[iso]||{}; c[iso][teamId]=c[iso][teamId]||{}
      for(const tId of Object.keys(c[iso])){ for(const r of Object.keys(c[iso][tId]||{})){ const arr = asArray(c[iso][tId][r]); if(arr.includes(name)) c[iso][tId][r] = arr.filter(n=> n!==name) } }
      const current = asArray(c[iso][teamId][role]); c[iso][teamId][role] = uniq([...current, name]); return c
    })
  }
  function autoFillCurrentTeam(){
    const team=teams.find(t=>t.id===activeTeamId); if(!team) return
    const roster = members.filter(m=>m.teams?.includes(team.id)).map(m=>m.name).sort((a,b)=>a.localeCompare(b, undefined, {sensitivity:'base'}))
    const pool = roster.length? roster : members.map(m=>m.name).sort((a,b)=>a.localeCompare(b, undefined, {sensitivity:'base'}))
    if(pool.length===0) return
    let idx=0
    setScheduleDate(prev=>{
      const c=structuredClone(prev)
      selectedDates.forEach(iso=>{
        c[iso]=c[iso]||{}; c[iso][team.id]=c[iso][team.id]||{}
        team.roles.forEach(role=>{
          const name=pool[idx % pool.length]
          for(const tId of Object.keys(c[iso])){ for(const r of Object.keys(c[iso][tId])){ const arr=asArray(c[iso][tId][r]); if(arr.includes(name)) c[iso][tId][r]=arr.filter(n=>n!==name) } }
          c[iso][team.id][role]=[name]; idx++
        })
      })
      return c
    })
  }
  function addDateFromPicker(val){ if(!val) return; const iso=fmtDate(val); setSelectedDates(prev=> Array.from(new Set([...prev, iso])).sort()) }
  function removeDate(iso){ setSelectedDates(prev=> prev.filter(x=> x!==iso)); setScheduleDate(prev=>{ const c=structuredClone(prev); delete c[iso]; return c }) }
  function pickAllSundaysCurrentMonth(){
    const now = new Date(); const y = now.getUTCFullYear(); const m = now.getUTCMonth()
    const first = new Date(Date.UTC(y,m,1)), next = new Date(Date.UTC(y,m+1,1))
    const out=[]; for(let d=new Date(first); d<next; d=new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()+1))){ if(d.getUTCDay()===0){ out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`) } }
    setSelectedDates(prev=> Array.from(new Set([...prev, ...out])).sort())
  }
  function exportXLSX(){
    const wb = XLSX.utils.book_new()
    const rows = [['Date','Weekday','Team','Role','Members','Sunday?']]
    selectedDates.forEach(iso=>{
      teams.forEach(team=>{
        team.roles.forEach(role=>{
          const mems = asArray(scheduleDate[iso]?.[team.id]?.[role]).join(', ')
          rows.push([iso, weekdayName(iso), team.name, role, mems, isSundayISO(iso)?'Yes':'No'])
        })
      })
    })
    const ws = XLSX.utils.aoa_to_sheet(rows); XLSX.utils.book_append_sheet(wb, ws, 'Datas')
    const out = XLSX.write(wb, { bookType:'xlsx', type:'array' })
    const blob = new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='escala.xlsx'; a.click(); URL.revokeObjectURL(url)
  }

  const summary = useMemo(()=>{
    const lines=[]; selectedDates.forEach(iso=>{
      const parts=[]; for(const team of teams){
        const roles = team.roles.map(r=> `${r}: ${asArray(scheduleDate[iso]?.[team.id]?.[r]).join(', ')||'—'}`).join(' | ')
        parts.push(`${team.name} [${roles}]`)
      }
      lines.push(`${iso} (${weekdayName(iso)}): ${parts.join(' || ')}`)
    }); return lines.join('\\n')
  }, [selectedDates, teams, scheduleDate])

  // Group members by team for panel
  function groupMembersByTeam(teams, members){
    const byId = Object.fromEntries(teams.map(t=>[t.id, {team:t, list:[]}])) ; const unassigned = []
    for(const m of members){ const ts=Array.isArray(m.teams)? m.teams:[]; if(!ts.length){ unassigned.push(m); continue } let placed=false; for(const tid of ts){ if(byId[tid]){ byId[tid].list.push(m); placed=true } } if(!placed) unassigned.push(m) }
    for(const k of Object.keys(byId)) byId[k].list.sort((a,b)=> a.name.localeCompare(b.name, undefined, {sensitivity:'base'}))
    unassigned.sort((a,b)=> a.name.localeCompare(b.name, undefined, {sensitivity:'base'}))
    return { groups:Object.values(byId), unassigned }
  }

  return (
    <div>
      <header>
        <div className="container hstack wrap">
          <img src={logo} alt="Logo" className="logo" />
          <h1 style={{fontSize:18, margin:0}}>Escala — Equipes</h1>
          <div className="spacer" />
          <span className="small">{t.sundayFixed}</span>
        </div>
      </header>

      <main className="container">
        {/* Space */}
        <div className="panel">
          <div className="hstack wrap" style={{gap:10}}>
            <b>{t.space}:</b>
            <input value={spaceId} onChange={e=>setSpaceId(e.target.value.trim())} placeholder="ex.: pic-demo"/>
            {supa ? <span className="small">{status || t.live}</span> : <span className="small">{t.notConnected}</span>}
            <button onClick={()=> fetchCloud(spaceId)}>{t.connect}</button>
          </div>
          <div className="small">Compartilhe com <code>?space=SEU_ID</code> para editar junto.</div>
        </div>

        {/* Dates */}
        <div className="panel">
          <b>{t.dates}</b>
          <div className="date-actions">
            <input type="date" onChange={(e)=> addDateFromPicker(e.target.value)} placeholder="dd/mm/aaaa"/>
            <button className="primary" onClick={pickAllSundaysCurrentMonth}>{t.pickSundays}</button>
          </div>
          <div className="section">
            {selectedDates.length===0 ? <span className="small">—</span> : (
              <table>
                <thead><tr><th>Data</th><th>{t.weekday}</th><th>Domingo?</th><th></th></tr></thead>
                <tbody>
                  {selectedDates.map(iso=> (
                    <tr key={iso}>
                      <td>{iso}</td>
                      <td>{weekdayName(iso)}</td>
                      <td>{isSundayISO(iso)? 'Sim':'Não'}</td>
                      <td><button onClick={()=> removeDate(iso)}>Remover</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="panel">
          <div className="hstack" style={{justifyContent:'space-between'}}>
            <b>{t.teamConfig}</b>
            <button className="primary" onClick={addTeam}>{t.addTeam}</button>
          </div>
          <div className="vstack" style={{marginTop:10}}>
            {teams.map(team=>{
              const rolesCsv = team.roles.join(', ')
              return (
                <div key={team.id} className="hstack wrap" style={{gap:8}}>
                  <input defaultValue={team.name} onBlur={(e)=> updateTeam(team.id, e.target.value, rolesCsv)} placeholder={t.teamName} />
                  <input defaultValue={rolesCsv} onBlur={(e)=> updateTeam(team.id, team.name, e.target.value)} placeholder={t.roles} style={{flex:1}} />
                  <button onClick={()=> removeTeam(team.id)}>{t.remove}</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Members */}
        <div className="panel">
          <b>{t.members}</b>
          <div className="hstack" style={{gap:8, margin:'10px 0'}}>
            <input value={newMember} onChange={e=>setNewMember(e.target.value)} placeholder={t.addMemberPlaceholder} style={{flex:1}}/>
            <button className="primary" onClick={addMember}>{t.add}</button>
          </div>
          {(() => { const {groups,unassigned}=groupMembersByTeam(teams,members); return (
            <div className="vstack" style={{gap:12}}>
              {groups.map(g => (
                <details key={g.team.id} open>
                  <summary><b>{g.team.name}</b> <span className="kpill">{g.list.length}</span></summary>
                  <div style={{display:'grid', gap:10, marginTop:8}}>
                    {g.list.map(m => (
                      <div key={m.name} className="vstack">
                        <div className="hstack" style={{justifyContent:'space-between'}}>
                          <span>{m.name}</span>
                          <button onClick={()=> removeMember(m.name)}>{t.remove}</button>
                        </div>
                        <select multiple size={3}
                          value={m.teams||[]}
                          onChange={(e)=>{
                            const selected = Array.from(e.target.selectedOptions).map(o=>o.value)
                            setMembers(prev=> prev.map(mm=> mm.name===m.name? {...mm, teams:selected} : mm))
                          }}
                          style={{minWidth:180}}>
                          {teams.map(team=> <option key={team.id} value={team.id}>{team.name}</option>)}
                        </select>
                        <div className="small">{t.rosterMemberTeams}</div>
                      </div>
                    ))}
                    {g.list.length===0 && <div className="small">— sem membros —</div>}
                  </div>
                </details>
              ))}
              <details open>
                <summary><b>Sem equipe</b> <span className="kpill">{unassigned.length}</span></summary>
                <div style={{display:'grid', gap:10, marginTop:8}}>
                  {unassigned.map(m => (
                    <div key={m.name} className="vstack">
                      <div className="hstack" style={{justifyContent:'space-between'}}>
                        <span>{m.name}</span>
                        <button onClick={()=> removeMember(m.name)}>{t.remove}</button>
                      </div>
                      <select multiple size={3}
                        value={m.teams||[]}
                        onChange={(e)=>{
                          const selected = Array.from(e.target.selectedOptions).map(o=>o.value)
                          setMembers(prev=> prev.map(mm=> mm.name===m.name? {...mm, teams:selected} : mm))
                        }}
                        style={{minWidth:180}}>
                        {teams.map(team=> <option key={team.id} value={team.id}>{team.name}</option>)}
                      </select>
                      <div className="small">{t.rosterMemberTeams}</div>
                    </div>
                  ))}
                  {unassigned.length===0 && <div className="small">— nenhum —</div>}
                </div>
              </details>
            </div>
          ) })()}
        </div>

        {/* Schedule for active team */}
        <div className="panel">
          <div className="hstack" style={{gap:8, marginBottom:8}}>
            <b>Equipes</b>
            <div className="hstack" style={{gap:6}}>
              {teams.map(team=> (
                <div key={team.id} className={'tab '+(activeTeamId===team.id?'active':'')} onClick={()=>setActiveTeamId(team.id)}>{team.name}</div>
              ))}
            </div>
          </div>
          {teams.filter(x=>x.id===activeTeamId).map(team=>{
            return (
              <div key={team.id} className="vstack" style={{gap:10}}>
                <b>Escala — {team.name}</b>
                <div style={{overflowX:'auto'}}>
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th><th>{t.weekday}</th>
                        {team.roles.map(r=> <th key={r}>{r}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDates.map(iso=>(
                        <tr key={iso}>
                          <td>{iso}</td>
                          <td>{weekdayName(iso)}</td>
                          {team.roles.map(role=> (
                            <td key={role}>
                              <div className="vstack" style={{gap:6}}>
                                <div className="chips">
                                  {asArray(scheduleDate[iso]?.[team.id]?.[role]).map(n => (
                                    <span key={n} className="chip">{n}<button className="chip-x" onClick={()=> removeAssigned(iso, team.id, role, n)}>×</button></span>
                                  ))}
                                </div>
                                <div className="hstack" style={{gap:6}}>
                                  <select id={`sel-${team.id}-${role}-${iso}`} defaultValue="">
                                    <option value="">{t.select}</option>
                                    {(() => { const groups = buildTeamOptionGroups(team.id, members); return (<>
                                      {groups.inTeam.length>0 && <optgroup label="Da equipe">{groups.inTeam.map(n=> <option key={n} value={n}>{n}</option>)}</optgroup>}
                                      {groups.others.length>0 && <optgroup label="Outros">{groups.others.map(n=> <option key={n} value={n}>{n}</option>)}</optgroup>}
                                    </>) })()}
                                  </select>
                                  <button className="mini-add" title="Adicionar" onClick={()=>{
                                    const el=document.getElementById(`sel-${team.id}-${role}-${iso}`)
                                    if(el && el.value){ assignDateAdd(iso, team.id, role, el.value); el.value='' }
                                  }}>＋</button>
                                </div>
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="hstack wrap" style={{gap:8}}>
                  <button onClick={autoFillCurrentTeam}>{t.autofill}</button>
                  <button onClick={()=>{ navigator.clipboard.writeText(summary); alert('OK') }}>{t.copy}</button>
                  <button onClick={exportXLSX}>{t.exportXLSX}</button>
                  <button onClick={()=>window.print()}>{t.print}</button>
                  <label className="small">Logo: <input type="file" accept="image/*" onChange={(e)=> e.target.files?.[0] && ((()=>{ const r=new FileReader(); r.onload=()=>setLogo(String(r.result)); r.readAsDataURL(e.target.files[0]) })()) } /></label>
                </div>
              </div>
            )
          })}
        </div>

        <div className="panel">
          <b>Resumo</b>
          <div className="section"><textarea readOnly value={summary} style={{width:'100%',minHeight:120}}></textarea></div>
        </div>
      </main>
    </div>
  )
}
