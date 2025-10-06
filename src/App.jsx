import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supa } from './lib/supa'

const I18N = {
  pt: { appTitle:'Escala — Equipes (Supabase)', sundayFixed:'Domingo é sempre obrigatório e fixo', branding:'Branding (logo)', uploadLogo:'Carregar logo', removeLogo:'Remover logo', language:'Idioma', teamConfig:'Equipes & Tarefas', addTeam:'Adicionar equipe', teamName:'Nome da equipe', roles:'Tarefas (separe por vírgula)', members:'Membros', addMemberPlaceholder:'Adicionar nome', add:'Adicionar', remove:'Remover', actions:'Ações', autofill:'Auto-preencher (round-robin) — equipe ativa', print:'Imprimir', copy:'Copiar resumo', teamTabs:'Equipes', schedule:'Escala por Data e Tarefa — ', select:'— Selecionar —', rule:'Regra: a mesma pessoa não pode estar, na mesma data, em duas equipes/tarefas diferentes. Ao escolher, o sistema remove alocações conflitantes.', rolesAvail:'Tarefas configuráveis por equipe.', tip:'Dica: o XLSX exporta abas por Datas.', sundayMandatory:'Domingo é obrigatório', confirmClear:'Limpar todas as alocações?', existsName:'Este nome já existe.', rosterMemberTeams:'Equipes deste membro (Ctrl/Cmd p/ múltiplos)', dates:'Datas específicas', addDate:'Adicionar data', exportXLSX:'Exportar XLSX', cannotRemoveSunday:'Domingo não pode ser removido', space:'Espaço', connect:'Conectar', saveCloud:'Gerar link do Space', linkReady:'Link copiado!', notConnected:'(sem Supabase configurado)', syncing:'Sincronizando…', live:'Ao vivo', weekday:'Dia da semana', pickSundays:'Selecionar todos os domingos do mês atual' },
  es: { appTitle:'Escala — Equipos (Supabase)', sundayFixed:'El domingo es siempre obligatorio y fijo', branding:'Branding (logo)', uploadLogo:'Subir logo', removeLogo:'Quitar logo', language:'Idioma', teamConfig:'Equipos y Tareas', addTeam:'Añadir equipo', teamName:'Nombre del equipo', roles:'Tareas (separadas por comas)', members:'Miembros', addMemberPlaceholder:'Agregar nombre', add:'Agregar', remove:'Quitar', actions:'Acciones', autofill:'Autocompletar (round-robin) — equipo activo', print:'Imprimir', copy:'Copiar resumen', teamTabs:'Equipos', schedule:'Escala por Fecha y Tarea — ', select:'— Seleccionar —', rule:'Regla: la misma persona no puede estar, en la misma fecha, en dos equipos/tareas diferentes. Al elegir, el sistema elimina asignaciones en conflicto.', rolesAvail:'Tareas configurables por equipo.', tip:'Consejo: XLSX exporta pestañas por Fechas.', sundayMandatory:'El domingo es obligatorio', confirmClear:'¿Limpiar todas las asignaciones?', existsName:'Ese nombre ya existe.', rosterMemberTeams:'Equipos de este miembro (Ctrl/Cmd para múltiples)', dates:'Fechas específicas', addDate:'Añadir fecha', exportXLSX:'Exportar XLSX', cannotRemoveSunday:'El domingo no se puede quitar', space:'Espacio', connect:'Conectar', saveCloud:'Generar link del Space', linkReady:'¡Link copiado!', notConnected:'(sin Supabase configurado)', syncing:'Sincronizando…', live:'En vivo', weekday:'Día de la semana', pickSundays:'Seleccionar todos los domingos del mes actual' },
  en: { appTitle:'Schedule — Teams (Supabase)', sundayFixed:'Sunday is always mandatory and fixed', branding:'Branding (logo)', uploadLogo:'Upload logo', removeLogo:'Remove logo', language:'Language', teamConfig:'Teams & Tasks', addTeam:'Add team', teamName:'Team name', roles:'Tasks (comma separated)', members:'Members', addMemberPlaceholder:'Add name', add:'Add', remove:'Remove', actions:'Actions', autofill:'Auto-fill (round-robin) — active team', print:'Print', copy:'Copy summary', teamTabs:'Teams', schedule:'Schedule by Date & Task — ', select:'— Select —', rule:'Rule: the same person cannot be, on the same date, in two different teams/tasks. Selecting clears conflicting assignments.', rolesAvail:'Tasks are configurable per team.', tip:'Tip: XLSX has a Dates tab.', sundayMandatory:'Sunday is mandatory', confirmClear:'Clear all assignments?', existsName:'This name already exists.', rosterMemberTeams:'This member\'s teams (Ctrl/Cmd for multiple)', dates:'Specific dates', addDate:'Add date', exportXLSX:'Export XLSX', cannotRemoveSunday:'Sunday cannot be removed', space:'Space', connect:'Connect', saveCloud:'Generate Space link', linkReady:'Link copied!', notConnected:'(Supabase not configured)', syncing:'Syncing…', live:'Live', weekday:'Weekday', pickSundays:'Select all Sundays of current month' }
}
const STORAGE_KEY = 'escala_midia_multi_team_v6'
const CONFIG_STORAGE_KEY = 'escala_midia_multi_team_config_v3'
function uid(){ return Math.random().toString(36).slice(2,9) }
function fmtDate(d){ if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d; const dt = new Date(d); const y = dt.getUTCFullYear(); const m = String(dt.getUTCMonth()+1).padStart(2,'0'); const day = String(dt.getUTCDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
function isSundayISO(iso){ const [y,m,d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m-1, d)).getUTCDay()===0 }
const WEEKDAY_NAMES = { pt: ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'], es: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] }
function weekdayName(iso, lang='pt'){ const [y,m,d] = iso.split('-').map(Number); const dow = new Date(Date.UTC(y, m-1, d)).getUTCDay(); return WEEKDAY_NAMES[lang][dow] }

function groupMembersByTeam(teams, members){
  const byId = Object.fromEntries(teams.map(t=>[t.id, {team:t, list:[]}]))
  const unassigned = []
  for(const m of members){
    const hasTeams = Array.isArray(m.teams) && m.teams.length>0
    if(!hasTeams){ unassigned.push(m); continue }
    let placed = false
    for(const tid of m.teams){ if(byId[tid]){ byId[tid].list.push(m); placed = true } }
    if(!placed) unassigned.push(m)
  }
  for(const k of Object.keys(byId)) byId[k].list.sort((a,b)=> a.name.localeCompare(b.name, undefined, {sensitivity:'base'}))
  unassigned.sort((a,b)=> a.name.localeCompare(b.name, undefined, {sensitivity:'base'}))
  return { groups: Object.values(byId), unassigned }
}


export default function App(){
  const [lang,setLang] = useState('pt'); const t = I18N[lang]
  const [logo, setLogo] = useState('/logo.png')

  // Members: { name, teams:[teamId,...] }
  const [members,setMembers] = useState([{ name:'Alice', teams:[] },{ name:'Bruno', teams:[] },{ name:'Camila', teams:[] },{ name:'Diego', teams:[] }])
  const [newMember,setNewMember] = useState('')
  const [teams,setTeams] = useState([{ id: uid(), name: 'Mídia', roles: ['Front','Livestream','Câmeras'] }])
  const [activeTeamId,setActiveTeamId] = useState(null)

  const [selectedDates, setSelectedDates] = useState([]) // ISO array
  const [scheduleDate, setScheduleDate] = useState({})   // iso -> teamId -> role -> member

  const [spaceId, setSpaceId] = useState(import.meta.env.VITE_SPACE_ID || 'default')
  const [status, setStatus] = useState('')
  const debTimer = useRef(null); const channelRef = useRef(null);
  const applyTimerRef = useRef(null); const lastRemotePayloadRef = useRef(null);
  const APPLY_INTERVAL_MS = 3000

  // Load (config first)
  useEffect(()=>{
    const rawCfg = localStorage.getItem(CONFIG_STORAGE_KEY)
    if(rawCfg){
      try{ const c=JSON.parse(rawCfg); Array.isArray(c.members)&&setMembers(c.members.map(m=> typeof m==='string'? {name:m,teams:[]}:m)); Array.isArray(c.teams)&&setTeams(c.teams) }catch{}
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if(raw){
      try{ const p=JSON.parse(raw); p.lang&&setLang(p.lang); p.logo&&setLogo(p.logo); Array.isArray(p.members)&&setMembers(p.members.map(m=> typeof m==='string'? {name:m,teams:[]}:m)); p.teams&&setTeams(p.teams); p.selectedDates&&setSelectedDates(p.selectedDates); p.scheduleDate&&setScheduleDate(p.scheduleDate); setActiveTeamId(p.activeTeamId ?? null) }catch{}
    } else { setActiveTeamId((prev)=> prev ?? (teams[0]?.id || null)) }
  },[])
  useEffect(()=>{ if(activeTeamId===null && teams.length) setActiveTeamId(teams[0].id) },[teams,activeTeamId])

  // Autosave (local)
  useEffect(()=>{ localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({members,teams})) }, [members,teams])
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, logo, members, teams, selectedDates, scheduleDate, activeTeamId })) }, [lang,logo,members,teams,selectedDates,scheduleDate,activeTeamId])

  // Supabase: fetch, subscribe, save (debounced)
  async function fetchCloud(id){ if(!supa) return; setStatus('Loading…'); const { data } = await supa.from('state').select('payload').eq('id', id).single(); if(data?.payload) applyPayload(data.payload,true); setStatus('') }
  function applyPayload(p, fromCloud=false){
  if (fromCloud && typeof p.__rev==='number' && p.__rev <= localRevRef.current) return;
  if (typeof p.__rev==='number') localRevRef.current = p.__rev; try{ p.lang&&setLang(p.lang); p.logo&&setLogo(p.logo); Array.isArray(p.members)&&setMembers(p.members.map(m=> typeof m==='string'? {name:m,teams:[]}:m)); p.teams&&setTeams(p.teams); p.selectedDates&&setSelectedDates(p.selectedDates); p.scheduleDate&&setScheduleDate(p.scheduleDate); setActiveTeamId(p.activeTeamId ?? null); if(fromCloud) setStatus(t.live) }catch{} }
  function scheduleCloudSave(){ if(!supa||!spaceId) return; 
    if(debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(async ()=>{ const payload = { lang, logo, members, teams, selectedDates, scheduleDate, activeTeamId , __rev: (localRevRef.current + 1) }; setStatus(t.syncing); localRevRef.current = payload.__rev;
      const { error } = await supa.from('state').upsert({ id: spaceId, payload }, { onConflict: 'id' }); if(error){console.warn(error); setStatus('')} else setStatus(t.live) }, 800) }
  useEffect(()=>{ scheduleCloudSave() }, [spaceId,lang,logo,members,teams,selectedDates,scheduleDate,activeTeamId])
  useEffect(()=>{ if(!supa||!spaceId) return; if(channelRef.current){channelRef.current.unsubscribe(); channelRef.current=null} const ch=supa.channel('state_changes_'+spaceId).on('postgres_changes',{event:'*',schema:'public',table:'state',filter:`id=eq.${spaceId}`},(payload)=>{ const row=payload.new||payload.record; if(row?.payload) applyPayload(row.payload,true) }).subscribe(); channelRef.current=ch; fetchCloud(spaceId); return ()=>{ try{ if(applyTimerRef.current) clearTimeout(applyTimerRef.current) }catch(e){} ch.unsubscribe() } },[spaceId])

  // Helpers UI
  function onLogoUpload(file){ const r=new FileReader(); r.onload=()=>setLogo(String(r.result)); r.readAsDataURL(file) }
  function addMember(){ const n=newMember.trim(); if(!n) return; if(members.some(m=>m.name===n)){ alert(t.existsName); return } setMembers([...members,{name:n,teams:[]}]); setNewMember('') }
  function removeMember(name){ setMembers(members.filter(m=>m.name!==name)); setScheduleDate(prev=>{ const c=structuredClone(prev); for(const iso of Object.keys(c)){ for(const teamId of Object.keys(c[iso]||{})){ for(const role of Object.keys(c[iso][teamId]||{})){ if(c[iso][teamId][role]===name) c[iso][teamId][role]='' } } } return c }) }
  function addTeam(){ const id=uid(); setTeams([...teams,{ id, name:'Nova Equipe', roles:['Papel A','Papel B'] }]); setActiveTeamId(id) }
  function updateTeam(id, name, rolesCsv){ const roles=rolesCsv.split(',').map(s=>s.trim()).filter(Boolean); setTeams(teams.map(t=> t.id===id? { ...t, name, roles } : t)) }
  function removeTeam(id){ setTeams(teams.filter(t=>t.id!==id)); setScheduleDate(prev=>{ const c=structuredClone(prev); for(const iso of Object.keys(c)){ if(c[iso]&&c[iso][id]) delete c[iso][id] } return c }); if(activeTeamId===id){ const nxt=teams.find(t=>t.id!==id)?.id||null; setActiveTeamId(nxt) } }
  function assignDate(iso, teamId, role, name){ setScheduleDate(prev=>{ const c=structuredClone(prev); c[iso]=c[iso]||{}; c[iso][teamId]=c[iso][teamId]||{}; for(const tId of Object.keys(c[iso])){ for(const r of Object.keys(c[iso][tId])){ if(c[iso][tId][r]===name) c[iso][tId][r]='' } } c[iso][teamId][role]=name; return c }) }
  function autoFillCurrentTeam(){ const team=teams.find(t=>t.id===activeTeamId); if(!team) return; const roster = members.filter(m=>m.teams?.includes(team.id)).map(m=>m.name); const pool = roster.length? roster : members.map(m=>m.name); if(pool.length===0) return; let idx=0; setScheduleDate(prev=>{ const c=structuredClone(prev); selectedDates.forEach(iso=>{ c[iso]=c[iso]||{}; c[iso][team.id]=c[iso][team.id]||{}; team.roles.forEach(role=>{ const name=pool[idx % pool.length]; for(const tId of Object.keys(c[iso])){ for(const r of Object.keys(c[iso][tId])){ if(c[iso][tId][r]===name) c[iso][tId][r]='' } } c[iso][team.id][role]=name; idx++ }) }); return c }) }
  function addDateFromPicker(val){ if(!val) return; const iso=fmtDate(val); setSelectedDates(prev=> Array.from(new Set([...prev, iso])).sort()) }
  function removeDate(iso){ setSelectedDates(prev=> prev.filter(x=> x!==iso)); setScheduleDate(prev=>{ const c=structuredClone(prev); delete c[iso]; return c }) }
  function pickAllSundaysCurrentMonth(){ const now=new Date(); const y=now.getUTCFullYear(); const m=now.getUTCMonth(); const first=new Date(Date.UTC(y,m,1)); const next=new Date(Date.UTC(y,m+1,1)); const out=[]; for(let d=new Date(first); d<next; d=new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()+1))){ if(d.getUTCDay()===0){ out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`) } } setSelectedDates(prev=> Array.from(new Set([...prev, ...out])).sort()) }
  function exportXLSX(){ const wb=XLSX.utils.book_new(); const dateRows=[['Date','Weekday','Team','Role','Member','Sunday?']]; selectedDates.forEach(iso=>{ teams.forEach(team=>{ team.roles.forEach(role=>{ dateRows.push([iso, weekdayName(iso, lang), team.name, role, (scheduleDate[iso]?.[team.id]?.[role]||''), isSundayISO(iso)?'Yes':'No']) }) }) }); const wsDates=XLSX.utils.aoa_to_sheet(dateRows); XLSX.utils.book_append_sheet(wb, wsDates, 'Datas'); const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'}); const blob=new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='escala.xlsx'; a.click(); URL.revokeObjectURL(url) }

  const summaryText = useMemo(()=>{ const lines=[]; selectedDates.forEach(iso=>{ const parts=[]; for(const team of teams){ const roles = team.roles.map(r=> `${r}: ${(scheduleDate[iso]?.[team.id]?.[r]||'—')}`).join(' | '); parts.push(`${team.name} [${roles}]`) } lines.push(`${iso} (${weekdayName(iso, lang)}): ${parts.join(' || ')}`) }); return lines.join('\n') },[scheduleDate, teams, lang, selectedDates])

  return (<div>
    <header><div className="container hstack">
      <img src={logo} className="logo" alt="Logo" /><h1>{t.appTitle}</h1><div className="spacer"></div>
      <span className="small">{''}</span>
      <select value={lang} onChange={e=>setLang(e.target.value)} style={{marginLeft:12}}>
        <option value="pt">Português</option><option value="es">Español</option><option value="en">English</option>
      </select>
    </div></header>

    <main className="container">
      {/* Space selector */}
      <div className="section panel">
        <div className="hstack wrap" style={{gap:12}}>
          <b>{t.space}:</b>
          <input value={spaceId} onChange={e=>setSpaceId(e.target.value.trim())} placeholder="ex.: pic-panama" />
          {supa ? <span className="status">{status || t.live}</span> : <span className="status">{t.notConnected}</span>}
          <button className="ghost" onClick={()=> fetchCloud(spaceId)}>{t.connect}</button>
          <button onClick={()=>{ const url = `${location.origin}${location.pathname}?space=${encodeURIComponent(spaceId)}`; navigator.clipboard.writeText(url); alert(t.linkReady + '\\n' + url) }}>{t.saveCloud}</button>
        </div>
        <div className="small">Use um <b>Space</b> (ex.: sua igreja) para todos acessarem os mesmos dados. Compartilhe o link com <code>?space=SEU_ID</code>.</div>
      </div>

      {/* Dates selection */}
      <div className="section panel">
        <b>{t.dates}</b>
        <div className="hstack wrap" style={{gap:8, marginTop:10}}>
          <input type="date" onChange={(e)=> addDateFromPicker(e.target.value)} />
          <button className="primary" onClick={pickAllSundaysCurrentMonth}>{t.pickSundays}</button>
        </div>
        <div className="section">
          {selectedDates.length===0 ? <span className="small">—</span> : (
            <table>
              <thead><tr><th>Data</th><th>{t.weekday}</th><th>Domingo?</th><th></th></tr></thead>
              <tbody>
                {selectedDates.map(iso=> (
                  <tr key={iso}>
                    <td>{iso}</td><td>{weekdayName(iso, lang)}</td><td>{isSundayISO(iso)? 'Sim' : 'Não'}</td>
                    <td><button onClick={()=>removeDate(iso)}>{t.remove}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Teams & Tasks */}
      <div className="section panel">
        <div className="hstack" style={{justifyContent:'space-between'}}>
          <b>{t.teamConfig}</b>
          <button className="primary" onClick={()=>{ const id=uid(); setTeams([...teams,{ id, name:'Nova Equipe', roles:['Papel A','Papel B'] }]); setActiveTeamId(id) }}>{t.addTeam}</button>
        </div>
        <div className="section" style={{display:'grid', gap:12}}>
          {teams.map(team=>{
            const rolesCsv=team.roles.join(', ')
            return (<div key={team.id} className="hstack wrap" style={{gap:8}}>
              <input defaultValue={team.name} onBlur={(e)=> setTeams(teams.map(t=> t.id===team.id? {...t, name:e.target.value}:t))} placeholder={t.teamName} />
              <input defaultValue={rolesCsv} onBlur={(e)=> setTeams(teams.map(t=> t.id===team.id? {...t, roles: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}:t))} placeholder={t.roles} style={{flex:1}} />
              <button onClick={()=>{ setTeams(teams.filter(t=>t.id!==team.id)); setScheduleDate(prev=>{ const c=structuredClone(prev); for(const iso of Object.keys(c)){ if(c[iso]&&c[iso][team.id]) delete c[iso][team.id] } return c }); if(activeTeamId===team.id){ const nxt=teams.find(t=>t.id!==team.id)?.id||null; setActiveTeamId(nxt) } }}>{t.remove}</button>
            </div>)
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

  {(() => {
    const { groups, unassigned } = groupMembersByTeam(teams, members);
    return (
      <div className="vstack" style={{gap:12}}>
        {groups.map(g => (
          <details key={g.team.id} open>
            <summary><b>{g.team.name}</b> <span className="kpill">{g.list.length}</span></summary>
            <div style={{display:'grid', gap:10, marginTop:8}}>
              {g.list.map(m => (
                <div key={m.name} className="vstack">
                  <div className="hstack" style={{justifyContent:'space-between'}}>
                    <span>{m.name}</span>
                    <button onClick={()=>removeMember(m.name)}>{t.remove}</button>
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
                  <button onClick={()=>removeMember(m.name)}>{t.remove}</button>
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
    )
  })()}
</div>


        <div className="panel" style={{gridColumn:'span 2'}}>
          <b>{t.actions}</b>
          <div className="section hstack wrap" style={{gap:8}}>
            <button onClick={autoFillCurrentTeam}>{t.autofill}</button>
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
          {teams.filter(x=>x.id===activeTeamId).map(team=> {
            const roster = members.filter(m=>m.teams?.includes(team.id)).map(m=>m.name)
            const options = roster.length? roster : members.map(m=>m.name)
            return (
            <div className="section" key={team.id}>
              <b>{t.schedule}{team.name}</b>
              <div className="section" style={{overflowX:'auto'}}>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>{t.weekday}</th>
                      {team.roles.map(r=> <th key={r}>{r}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDates.map(iso=> (
                      <tr key={iso}>
                        <td>{iso}</td>
                        <td>{weekdayName(iso, lang)}</td>
                        {team.roles.map(role=> (
                          <td key={role}>
                            <select value={(scheduleDate[iso]?.[team.id]?.[role])||''} onChange={e=> assignDate(iso, team.id, role, e.target.value) }>
                              <option value="">{t.select}</option>
                              {options.map(n=> <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="legend">
                <p>{t.rule}</p>
                <p>{t.rolesAvail}</p>
              </div>
            </div>
          )})}
        </div>
      </div>

      <div className="section panel">
        <b>Resumo / Resumen / Summary</b>
        <div className="section"><textarea readOnly value={summaryText}></textarea></div>
      </div>
    </main>
  </div>)}
