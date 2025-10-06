import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supa } from './lib/supa'

const I18N = {
  pt: { appTitle:'Escala — Equipes (Supabase)', sundayFixed:'Domingo é sempre obrigatório e fixo', branding:'Branding (logo)', uploadLogo:'Carregar logo', removeLogo:'Remover logo', language:'Idioma', configDays:'Configuração de Dias (Semanal)', days:{monday:'Segunda',tuesday:'Terça',wednesday:'Quarta',thursday:'Quinta',friday:'Sexta',saturday:'Sábado',sunday:'Domingo (fixo)'}, teamConfig:'Equipes & Tarefas', addTeam:'Adicionar equipe', teamName:'Nome da equipe', roles:'Tarefas (separe por vírgula)', members:'Membros', addMemberPlaceholder:'Adicionar nome', add:'Adicionar', remove:'Remover', actions:'Ações', autofill:'Auto-preencher (round-robin) — equipe ativa', clear:'Limpar alocações', save:'Salvar (local)', export:'Exportar JSON', import:'Importar JSON', print:'Imprimir', copy:'Copiar resumo', teamTabs:'Equipes', schedule:'Escala por Dia e Tarefa — ', select:'— Selecionar —', rule:'Regra: a mesma pessoa não pode estar, no mesmo dia, em duas equipes/tarefas diferentes. Ao escolher, o sistema remove alocações conflitantes.', rolesAvail:'Tarefas configuráveis por equipe.', tip:'Dica: o JSON exportado pode ser reimportado depois para restaurar sua escala.', sundayMandatory:'Domingo é obrigatório', confirmClear:'Limpar todas as alocações?', existsName:'Este nome já existe.', roster:'Membros desta equipe (Ctrl/Cmd para múltiplos)', dates:'Datas específicas', addDate:'Adicionar data', weekly:'Semanal', exportXLSX:'Exportar XLSX', cannotRemoveSunday:'Domingo não pode ser removido', space:'Espaço', connect:'Conectar', saveCloud:'Salvar na Nuvem', linkReady:'Link copiado!', notConnected:'(sem Supabase configurado)', syncing:'Sincronizando…', live:'Ao vivo', },
  es: { appTitle:'Escala — Equipos (Supabase)', sundayFixed:'El domingo es siempre obligatorio y fijo', branding:'Branding (logo)', uploadLogo:'Subir logo', removeLogo:'Quitar logo', language:'Idioma', configDays:'Configuración de Días (Semanal)', days:{monday:'Lunes',tuesday:'Martes',wednesday:'Miércoles',thursday:'Jueves',friday:'Viernes',saturday:'Sábado',sunday:'Domingo (fijo)'}, teamConfig:'Equipos y Tareas', addTeam:'Añadir equipo', teamName:'Nombre del equipo', roles:'Tareas (separadas por comas)', members:'Miembros', addMemberPlaceholder:'Agregar nombre', add:'Agregar', remove:'Quitar', actions:'Acciones', autofill:'Autocompletar (round-robin) — equipo activo', clear:'Limpiar asignaciones', save:'Guardar (local)', export:'Exportar JSON', import:'Importar JSON', print:'Imprimir', copy:'Copiar resumen', teamTabs:'Equipos', schedule:'Escala por Día y Tarea — ', select:'— Seleccionar —', rule:'Regla: la misma persona no puede estar, el mismo día, en dos equipos/tareas diferentes. Al elegir, el sistema elimina asignaciones en conflicto.', rolesAvail:'Tareas configurables por equipo.', tip:'Consejo: el JSON exportado puede reimportarse luego para restaurar tu escala.', sundayMandatory:'El domingo es obligatorio', confirmClear:'¿Limpiar todas las asignaciones?', existsName:'Ese nombre ya existe.', roster:'Miembros de este equipo (Ctrl/Cmd para múltiples)', dates:'Fechas específicas', addDate:'Añadir fecha', weekly:'Semanal', exportXLSX:'Exportar XLSX', cannotRemoveSunday:'El domingo no se puede quitar', space:'Espacio', connect:'Conectar', saveCloud:'Guardar en la Nube', linkReady:'¡Link copiado!', notConnected:'(sin Supabase configurado)', syncing:'Sincronizando…', live:'En vivo', },
  en: { appTitle:'Schedule — Teams (Supabase)', sundayFixed:'Sunday is always mandatory and fixed', branding:'Branding (logo)', uploadLogo:'Upload logo', removeLogo:'Remove logo', language:'Language', configDays:'Day Configuration (Weekly)', days:{monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',saturday:'Saturday',sunday:'Sunday (fixed)'}, teamConfig:'Teams & Tasks', addTeam:'Add team', teamName:'Team name', roles:'Tasks (comma separated)', members:'Members', addMemberPlaceholder:'Add name', add:'Add', remove:'Remove', actions:'Actions', autofill:'Auto-fill (round-robin) — active team', clear:'Clear assignments', save:'Save (local)', export:'Export JSON', import:'Import JSON', print:'Print', copy:'Copy summary', teamTabs:'Teams', schedule:'Schedule by Day & Task — ', select:'— Select —', rule:'Rule: the same person cannot be, on the same day, in two different teams/tasks. Selecting clears conflicting assignments.', rolesAvail:'Tasks are configurable per team.', tip:'Tip: The exported JSON can be re-imported later to restore your schedule.', sundayMandatory:'Sunday is mandatory', confirmClear:'Clear all assignments?', existsName:'This name already exists.', roster:'This team roster (Ctrl/Cmd for multiple)', dates:'Specific dates', addDate:'Add date', weekly:'Weekly', exportXLSX:'Export XLSX', cannotRemoveSunday:'Sunday cannot be removed', space:'Space', connect:'Connect', saveCloud:'Save to Cloud', linkReady:'Link copied!', notConnected:'(Supabase not configured)', syncing:'Syncing…', live:'Live', }
}
const WEEK_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const STORAGE_KEY = 'escala_midia_multi_team_v4'
const CONFIG_STORAGE_KEY = 'escala_midia_multi_team_config_v1'
function uid(){ return Math.random().toString(36).slice(2,9) }
function fmtDate(d){
  // Accept 'YYYY-MM-DD' from <input type="date"> and return the same string
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth()+1).padStart(2,'0');
  const day = String(dt.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function isSundayISO(iso){
  // Compute weekday in UTC to avoid TZ shifts
  const [y,m,d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m-1, d)).getUTCDay();
  return dow === 0;
}

export default function App(){
  const [lang,setLang] = useState('pt'); const t = I18N[lang]
  const [logo, setLogo] = useState('/logo.png')
  const [members,setMembers] = useState(['Alice','Bruno','Camila','Diego'])
  const [newMember,setNewMember] = useState('')
  const [spaceId, setSpaceId] = useState(import.meta.env.VITE_SPACE_ID || 'default')

  const [teams,setTeams] = useState([
    { id: uid(), name: 'Mídia', roles: ['Front','Livestream','Câmeras'], teamMembers: ['Alice','Bruno','Camila','Diego'] }
  ])
  const [activeTeamId,setActiveTeamId] = useState(null)

  const [daysActive,setDaysActive] = useState({ monday:true, tuesday:true, wednesday:true, thursday:true, friday:true, saturday:false, sunday:true })
  const [schedule,setSchedule] = useState(()=>{ const base={}; WEEK_KEYS.forEach(d=> base[d]={}); return base })

  const [selectedDates, setSelectedDates] = useState([]) // ISO array
  const [scheduleDate, setScheduleDate] = useState({})   // map iso -> teamId -> role -> member

  const [mode, setMode] = useState('weekly')
  const [newDate, setNewDate] = useState('')

  const [status, setStatus] = useState('') // syncing status
  const lastCloud = useRef(null)
  const channelRef = useRef(null)

  // LOCAL LOAD (config + full state)
  useEffect(()=>{
    const rawConfig = localStorage.getItem(CONFIG_STORAGE_KEY)
    if(rawConfig){
      try{ const c=JSON.parse(rawConfig); Array.isArray(c.members)&&setMembers(c.members); Array.isArray(c.teams)&&setTeams(c.teams) }catch{}
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if(raw){
      try{
        const p = JSON.parse(raw)
        p.lang && setLang(p.lang)
        p.logo && setLogo(p.logo)
        p.members && setMembers(p.members)
        p.teams && setTeams(p.teams)
        p.daysActive && setDaysActive({ ...p.daysActive, sunday:true })
        p.schedule && setSchedule(p.schedule)
        p.selectedDates && setSelectedDates(p.selectedDates)
        p.scheduleDate && setScheduleDate(p.scheduleDate)
        setActiveTeamId(p.activeTeamId ?? null)
        p.mode && setMode(p.mode)
      }catch{}
    }else{
      setActiveTeamId((prev)=> prev ?? (teams[0]?.id || null))
    }
  },[])

  useEffect(()=>{ if(activeTeamId===null && teams.length) setActiveTeamId(teams[0].id) },[teams,activeTeamId])

  // AUTOSAVE local (full state + config)
  useEffect(()=>{ const cfg = { members, teams }; localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg)) }, [members, teams])
  useEffect(()=>{
    const data = { lang, logo, members, teams, daysActive:{...daysActive,sunday:true}, schedule, selectedDates, scheduleDate, activeTeamId, mode }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [lang, logo, members, teams, daysActive, schedule, selectedDates, scheduleDate, activeTeamId, mode])

  // ---------- SUPABASE (shared persistence) ----------
  async function fetchCloud(id){
    if(!supa) return
    setStatus('Loading…')
    const { data, error } = await supa.from('state').select('payload, updated_at').eq('id', id).single()
    if(error && error.code !== 'PGRST116'){ // not found
      console.warn(error); setStatus('')
      return
    }
    if(data && data.payload){
      lastCloud.current = data.updated_at
      applyPayload(data.payload, true)
    }
    setStatus('')
  }

  function applyPayload(p, fromCloud=false){
    try{
      p.lang && setLang(p.lang)
      p.logo && setLogo(p.logo)
      Array.isArray(p.members) && setMembers(p.members)
      Array.isArray(p.teams) && setTeams(p.teams)
      p.daysActive && setDaysActive({ ...p.daysActive, sunday:true })
      p.schedule && setSchedule(p.schedule)
      p.selectedDates && setSelectedDates(p.selectedDates)
      p.scheduleDate && setScheduleDate(p.scheduleDate)
      setActiveTeamId(p.activeTeamId ?? null)
      p.mode && setMode(p.mode)
      if(fromCloud) setStatus(t.live)
    }catch(e){ console.warn('applyPayload failed', e) }
  }

  const debTimer = useRef(null)
  function scheduleCloudSave(){
    if(!supa || !spaceId) return
    if(debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(async ()=>{
      const payload = { lang, logo, members, teams, daysActive:{...daysActive,sunday:true}, schedule, selectedDates, scheduleDate, activeTeamId, mode }
      setStatus(t.syncing)
      const { data, error } = await supa.from('state').upsert({ id: spaceId, payload }, { onConflict: 'id' }).select('updated_at').single()
      if(error){ console.warn(error); setStatus('') }
      else { lastCloud.current = data.updated_at; setStatus(t.live) }
    }, 800)
  }

  // On every change, push to cloud (debounced)
  useEffect(()=>{ scheduleCloudSave() }, [spaceId, lang, logo, members, teams, daysActive, schedule, selectedDates, scheduleDate, activeTeamId, mode])

  // Real-time subscription
  useEffect(()=>{
    if(!supa || !spaceId) return
    if(channelRef.current){ channelRef.current.unsubscribe(); channelRef.current=null }
    const ch = supa.channel('state_changes_'+spaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'state', filter: `id=eq.${spaceId}` }, (payload)=>{
        try{
          const row = payload.new || payload.record
          if(!row) return
          // naive merge; rely on updated_at from server to avoid loops
          applyPayload(row.payload, true)
        }catch(e){}
      })
      .subscribe()
    channelRef.current = ch
    // initial fetch
    fetchCloud(spaceId)
    return ()=>{ ch.unsubscribe() }
  }, [spaceId])

  // ---------- App logic (igual às versões anteriores) ----------
  function save(){ alert('Local save is automatic now 😉') }
  function clearAll(){
    if(!confirm(t.confirmClear)) return
    const c={}; WEEK_KEYS.forEach(d=>c[d]={}); setSchedule(c)
    setSelectedDates([]); setScheduleDate({})
  }
  function exportJSON(){
    const blob=new Blob([JSON.stringify({ lang, logo, members, teams, daysActive:{...daysActive,sunday:true}, schedule, selectedDates, scheduleDate }, null, 2)],{type:'application/json'})
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='escala-midia.json'; a.click(); URL.revokeObjectURL(url)
  }
  function importJSON(file){
    const r=new FileReader(); r.onload=()=>{ try{ const p=JSON.parse(String(r.result)); applyPayload(p) }catch{ alert('Invalid file.') } }; r.readAsText(file)
  }
  function onLogoUpload(file){ const r=new FileReader(); r.onload=()=>setLogo(String(r.result)); r.readAsDataURL(file) }
  function addMember(){ const n=newMember.trim(); if(!n) return; if(members.includes(n)){ alert(t.existsName); return } setMembers([...members,n]); setNewMember('') }
  function removeMember(name){ setMembers(members.filter(m=>m!==name)); setSchedule(prev=>{ const c=structuredClone(prev); WEEK_KEYS.forEach(d=>{ for(const teamId of Object.keys(c[d]||{})){ for(const role of Object.keys(c[d][teamId]||{})){ if(c[d][teamId][role]===name) c[d][teamId][role]='' } } }); return c }); setScheduleDate(prev=>{ const c=structuredClone(prev); for(const iso of Object.keys(c)){ for(const teamId of Object.keys(c[iso]||{})){ for(const role of Object.keys(c[iso][teamId]||{})){ if(c[iso][teamId][role]===name) c[iso][teamId][role]='' } } } return c }) }
  function addTeam(){ const id=uid(); setTeams([...teams,{ id, name:'Nova Equipe', roles:['Papel A','Papel B'], teamMembers:[] }]); setActiveTeamId(id) }
  function updateTeam(id, name, rolesCsv){ const roles=rolesCsv.split(',').map(s=>s.trim()).filter(Boolean); setTeams(teams.map(t=> t.id===id? { ...t, name, roles } : t)) }
  function updateTeamMembers(id, selected){ setTeams(teams.map(t=> t.id===id? { ...t, teamMembers:selected } : t)) }
  function removeTeam(id){ setTeams(teams.filter(t=>t.id!==id)); setSchedule(prev=>{ const c=structuredClone(prev); WEEK_KEYS.forEach(d=>{ if(c[d]&&c[d][id]) delete c[d][id] }); return c }); setScheduleDate(prev=>{ const c=structuredClone(prev); for(const iso of Object.keys(c)){ if(c[iso]&&c[iso][id]) delete c[iso][id] } return c }); if(activeTeamId===id){ const nxt=teams.find(t=>t.id!==id)?.id||null; setActiveTeamId(nxt) } }
  function assignWeekly(day, teamId, role, name){ setSchedule(prev=>{ const c=structuredClone(prev); c[day]=c[day]||{}; c[day][teamId]=c[day][teamId]||{}; for(const tId of Object.keys(c[day])){ for(const r of Object.keys(c[day][tId])){ if(c[day][tId][r]===name) c[day][tId][r]='' } } c[day][teamId][role]=name; return c }) }
  function assignDate(iso, teamId, role, name){ setScheduleDate(prev=>{ const c=structuredClone(prev); c[iso]=c[iso]||{}; c[iso][teamId]=c[iso][teamId]||{}; for(const tId of Object.keys(c[iso])){ for(const r of Object.keys(c[iso][tId])){ if(c[iso][tId][r]===name) c[iso][tId][r]='' } } c[iso][teamId][role]=name; return c }) }
  function autoFillCurrentTeam(){ const team=teams.find(t=>t.id===activeTeamId); if(!team) return; const pool=(team.teamMembers && team.teamMembers.length? team.teamMembers : members); if(pool.length===0) return;
    if(mode==='weekly'){ let idx=0; setSchedule(prev=>{ const c=structuredClone(prev); WEEK_KEYS.filter(d=>daysActive[d]).forEach(day=>{ c[day]=c[day]||{}; c[day][team.id]=c[day][team.id]||{}; team.roles.forEach(role=>{ const name=pool[idx % pool.length]; for(const tId of Object.keys(c[day])){ for(const r of Object.keys(c[day][tId])){ if(c[day][tId][r]===name) c[day][tId][r]='' } } c[day][team.id][role]=name; idx++ }) }); return c }) }
    else { let idx=0; setScheduleDate(prev=>{ const c=structuredClone(prev); selectedDates.forEach(iso=>{ c[iso]=c[iso]||{}; c[iso][team.id]=c[iso][team.id]||{}; team.roles.forEach(role=>{ const name=pool[idx % pool.length]; for(const tId of Object.keys(c[iso])){ for(const r of Object.keys(c[iso][tId])){ if(c[iso][tId][r]===name) c[iso][tId][r]='' } } c[iso][team.id][role]=name; idx++ }) }); return c }) }
  }
  function addDateFromPicker(){ if(!newDate) return; const iso=fmtDate(newDate); setSelectedDates(prev=> Array.from(new Set([...prev, iso])).sort()) }
  function removeDate(iso){ if(isSundayISO(iso)){ alert(t.cannotRemoveSunday); return } setSelectedDates(prev=> prev.filter(x=> x!==iso)); setScheduleDate(prev=>{ const c=structuredClone(prev); delete c[iso]; return c }) }
  function exportXLSX(){
    const wb = XLSX.utils.book_new()
    const weeklyRows = [['Day','Team','Role','Member']]
    WEEK_KEYS.filter(d=>daysActive[d]).forEach(day=>{
      teams.forEach(team=>{
        team.roles.forEach(role=>{
          weeklyRows.push([I18N[lang].days[day], team.name, role, (schedule[day]?.[team.id]?.[role]||'')])
        })
      })
    })
    const wsWeekly = XLSX.utils.aoa_to_sheet(weeklyRows); XLSX.utils.book_append_sheet(wb, wsWeekly, 'Semanal')
    const dateRows = [['Date','Team','Role','Member','Sunday?']]
    selectedDates.forEach(iso=>{
      teams.forEach(team=>{
        team.roles.forEach(role=>{
          dateRows.push([iso, team.name, role, (scheduleDate[iso]?.[team.id]?.[role]||''), isSundayISO(iso)?'Yes':'No'])
        })
      })
    })
    const wsDates = XLSX.utils.aoa_to_sheet(dateRows); XLSX.utils.book_append_sheet(wb, wsDates, 'Datas')
    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' })
    const blob = new Blob([wbout], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'escala.xlsx'; a.click(); URL.revokeObjectURL(url)
  }

  const summaryText = useMemo(()=>{
    const lines=[];
    if(mode==='weekly'){ WEEK_KEYS.filter(d=>daysActive[d]).forEach(day=>{ const dayLabel=I18N[lang].days[day]; const parts=[]; for(const team of teams){ const roles = team.roles.map(r=> `${r}: ${(schedule[day]?.[team.id]?.[r]||'—')}`).join(' | '); parts.push(`${team.name} [${roles}]`) } lines.push(`${dayLabel}: ${parts.join(' || ')}`) }) }
    else { selectedDates.forEach(iso=>{ const parts=[]; for(const team of teams){ const roles = team.roles.map(r=> `${r}: ${(scheduleDate[iso]?.[team.id]?.[r]||'—')}`).join(' | '); parts.push(`${team.name} [${roles}]`) } lines.push(`${iso}: ${parts.join(' || ')}`) }) }
    return lines.join('\\n')
  },[schedule, daysActive, teams, lang, mode, selectedDates, scheduleDate])

  return (
    <div>
      <header>
        <div className="container hstack">
          <img src={logo} className="logo" alt="Logo" />
          <h1>{t.appTitle}</h1>
          <div className="spacer"></div>
          <span className="small">{t.sundayFixed}</span>
          <select value={lang} onChange={e=>setLang(e.target.value)} style={{marginLeft:12}}>
            <option value="pt">Português</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </header>

      <main className="container">
        {/* Cloud / Space selector */}
        <div className="section panel">
          <div className="hstack wrap" style={{gap:12}}>
            <b>{t.space}:</b>
            <input value={spaceId} onChange={e=>setSpaceId(e.target.value.trim())} placeholder="ex.: pic-panama" />
            {supa ? <span className="status">{status || t.live}</span> : <span className="status">{t.notConnected}</span>}
            <button className="ghost" onClick={()=> fetchCloud(spaceId)}>{t.connect}</button>
            <button onClick={()=>{
              const payload = { lang, logo, members, teams, daysActive:{...daysActive,sunday:true}, schedule, selectedDates, scheduleDate, activeTeamId, mode }
              const url = `${location.origin}${location.pathname}?space=${encodeURIComponent(spaceId)}`
              navigator.clipboard.writeText(url)
              alert(t.linkReady + '\\n' + url)
            }}>{t.saveCloud}</button>
          </div>
          <div className="small">Use um <b>Space</b> (ex.: sua igreja) para todos acessarem os mesmos dados. Compartilhe o link com <code>?space=SEU_ID</code>.</div>
        </div>

        {/* Branding */}
        <div className="section panel">
          <div className="hstack wrap" style={{gap:12}}>
            <b>{t.branding}</b>
            <label className="file">
              <input type="file" accept="image/*" style={{display:'none'}} onChange={(e)=> e.target.files?.[0] && onLogoUpload(e.target.files[0]) }/>
              <span>{t.uploadLogo}</span>
            </label>
            <button className="ghost" onClick={()=>setLogo('/logo.png')}>{t.removeLogo}</button>
            <span className="small">{t.sundayFixed}</span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="section panel">
          <div className="hstack" style={{gap:8}}>
            <span className={"tab "+(mode==='weekly'?'active':'')} onClick={()=>setMode('weekly')}>{t.weekly}</span>
            <span className={"tab "+(mode==='dates'?'active':'')} onClick={()=>setMode('dates')}>{t.dates}</span>
            <div className="spacer"></div>
            <span className="kpill">{mode==='weekly' ? 'MODE: WEEKLY' : 'MODE: DATES'}</span>
          </div>
        </div>

        {/* Weekly config or Dates */}
        {mode==='weekly' ? (
          <div className="section panel">
            <b>{t.configDays}</b>
            <div className="section hstack wrap">
              {WEEK_KEYS.map(key=>{
                const isSun = key==='sunday'; const active=!!daysActive[key]
                return (
                  <button key={key} className="badge" onClick={()=>{ if(isSun) return; setDaysActive({...daysActive, [key]:!active}) }} title={isSun? t.sundayMandatory : ''} style={{opacity:isSun?.8:1, background: active? 'var(--accent)' : ''}}>
                    {t.days[key]}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <DatesPanel {...{I18N, lang, t, selectedDates, setSelectedDates, scheduleDate, setScheduleDate}} />
        )}

        {/* Teams & Tasks */}
        <div className="section panel">
          <div className="hstack" style={{justifyContent:'space-between'}}>
            <b>{t.teamConfig}</b>
            <button className="primary" onClick={addTeam}>{t.addTeam}</button>
          </div>
          <div className="section" style={{display:'grid', gap:12}}>
            {teams.map(team=>{
              const rolesCsv = team.roles.join(', ')
              return (
                <div key={team.id} className="hstack wrap" style={{gap:8}}>
                  <input defaultValue={team.name} onBlur={(e)=> updateTeam(team.id, e.target.value, rolesCsv)} placeholder={t.teamName} />
                  <input defaultValue={rolesCsv} onBlur={(e)=> updateTeam(team.id, team.name, e.target.value)} placeholder={t.roles} style={{flex:1}} />
                  <div className="hstack" style={{gap:8, alignItems:'stretch'}}>
                    <select multiple size={4} value={(team.teamMembers||[])}
                      onChange={(e)=>{ const opts = Array.from(e.target.selectedOptions).map(o=>o.value); updateTeamMembers(team.id, opts) }} style={{minWidth:180}}>
                      {members.map(m=> <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="small" style={{maxWidth:220}}>{t.roster}</div>
                  </div>
                  <button onClick={()=>removeTeam(team.id)}>{t.remove}</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Members & Actions */}
        <div className="section grid grid-3">
          <div className="panel">
            <b>{t.members}</b>
            <div className="hstack" style={{gap:8, margin:'10px 0'}}>
              <input value={newMember} onChange={e=>setNewMember(e.target.value)} placeholder={t.addMemberPlaceholder} style={{flex:1}}/>
              <button className="primary" onClick={addMember}>{t.add}</button>
            </div>
            <div style={{display:'grid', gap:6}}>
              {members.map(m=>(
                <div key={m} className="hstack" style={{justifyContent:'space-between'}}>
                  <span>{m}</span>
                  <button onClick={()=>removeMember(m)}>{t.remove}</button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{gridColumn:'span 2'}}>
            <b>{t.actions}</b>
            <div className="section hstack wrap" style={{gap:8}}>
              <button onClick={autoFillCurrentTeam}>{t.autofill}</button>
              <button className="warn" onClick={clearAll}>{t.clear}</button>
              <button onClick={exportJSON}>{t.export}</button>
              <label className="file">
                <input type="file" accept="application/json" style={{display:'none'}} onChange={(e)=> e.target.files?.[0] && importJSON(e.target.files[0]) }/>
                <span>{t.import}</span>
              </label>
              <button onClick={()=>window.print()}>{t.print}</button>
              <button onClick={()=>{ navigator.clipboard.writeText(summaryText); alert('OK') }}>{t.copy}</button>
              <button onClick={exportXLSX}>{t.exportXLSX}</button>
            </div>

            {/* Team tabs */}
            <div className="section">
              <div className="tabbar">
                {teams.map(team=> (
                  <div key={team.id} className={'tab '+(activeTeamId===team.id?'active':'')} onClick={()=>setActiveTeamId(team.id)}>{team.name}</div>
                ))}
              </div>
            </div>

            {/* Schedule table for active team */}
            {teams.filter(x=>x.id===activeTeamId).map(team=> (
              <div className="section" key={team.id}>
                <b>{t.schedule}{team.name}</b>
                <div className="section" style={{overflowX:'auto'}}>
                  <table>
                    <thead>
                      <tr>
                        <th>{mode==='weekly' ? 'Dia' : 'Data'}</th>
                        {team.roles.map(r=> <th key={r}>{r}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {mode==='weekly' ? (
                        WEEK_KEYS.filter(d=>daysActive[d]).map(day=> (
                          <tr key={day}>
                            <td>{t.days[day]}</td>
                            {team.roles.map(role=> (
                              <td key={role}>
                                <select value={(schedule[day]?.[team.id]?.[role])||''} onChange={e=> assignWeekly(day, team.id, role, e.target.value) }>
                                  <option value="">{t.select}</option>
                                  {(team.teamMembers && team.teamMembers.length? team.teamMembers : members).map(m=> <option key={m} value={m}>{m}</option>)}
                                </select>
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        selectedDates.map(iso=> (
                          <tr key={iso}>
                            <td>{iso}</td>
                            {team.roles.map(role=> (
                              <td key={role}>
                                <select value={(scheduleDate[iso]?.[team.id]?.[role])||''} onChange={e=> assignDate(iso, team.id, role, e.target.value) }>
                                  <option value="">{t.select}</option>
                                  {(team.teamMembers && team.teamMembers.length? team.teamMembers : members).map(m=> <option key={m} value={m}>{m}</option>)}
                                </select>
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="legend">
                  <p>{t.rule}</p>
                  <p>{t.rolesAvail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section panel">
          <b>Resumo / Resumen / Summary</b>
          <div className="section">
            <textarea readOnly value={summaryText}></textarea>
          </div>
        </div>

      </main>
    </div>
  )
}

function DatesPanel({I18N, lang, t, selectedDates, setSelectedDates, scheduleDate, setScheduleDate}){
  const [newDate, setNewDate] = useState('')
  function fmtDate(d){ if (typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d; const dt=new Date(d); const y=dt.getUTCFullYear(); const m=String(dt.getUTCMonth()+1).padStart(2,'0'); const day=String(dt.getUTCDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
  function isSundayISO(iso){ const [y,m,d]=iso.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay()===0 }

  function addDateFromPicker(){ if(!newDate) return; const iso=fmtDate(newDate); setSelectedDates(prev=> Array.from(new Set([...prev, iso])).sort()) }
  function removeDate(iso){ if(isSundayISO(iso)){ alert(t.cannotRemoveSunday); return } setSelectedDates(prev=> prev.filter(x=> x!==iso)); setScheduleDate(prev=>{ const c=structuredClone(prev); delete c[iso]; return c }) }

  return (
    <div className="section panel">
      <b>{t.dates}</b>
      <div className="hstack wrap" style={{gap:8, marginTop:10}}>
        <input type="date" value={newDate} onChange={(e)=> setNewDate(e.target.value)} />
        <button className="primary" onClick={addDateFromPicker}>{t.addDate}</button>
      </div>
      <div className="section">
        {selectedDates.length===0 ? <span className="small">—</span> : (
          <table>
            <thead><tr><th>Data</th><th>Domingo?</th><th></th></tr></thead>
            <tbody>
              {selectedDates.map(iso=> (
                <tr key={iso}>
                  <td>{iso}</td>
                  <td>{isSundayISO(iso)? 'Sim' : 'Não'}</td>
                  <td><button onClick={()=>removeDate(iso)} disabled={isSundayISO(iso)}>{t.remove}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
