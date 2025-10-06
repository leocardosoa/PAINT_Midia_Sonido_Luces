import React, { useEffect, useMemo, useState } from 'react'

// -------- i18n --------
const I18N = {
  pt: {
    appTitle: 'Escala — Equipes de Mídia',
    sundayFixed: 'Domingo é sempre obrigatório e fixo',
    branding: 'Branding (logo)',
    uploadLogo: 'Carregar logo',
    removeLogo: 'Remover logo',
    language: 'Idioma',
    configDays: 'Configuração de Dias',
    days: { monday:'Segunda', tuesday:'Terça', wednesday:'Quarta', thursday:'Quinta', friday:'Sexta', saturday:'Sábado', sunday:'Domingo (fixo)' },
    teamConfig: 'Equipes & Tarefas',
    addTeam: 'Adicionar equipe',
    teamName: 'Nome da equipe',
    roles: 'Tarefas (separe por vírgula)',
    update: 'Atualizar',
    remove: 'Remover',
    teamTabs: 'Equipes',
    members: 'Membros',
    addMemberPlaceholder: 'Adicionar nome',
    add: 'Adicionar',
    actions: 'Ações',
    autofill: 'Auto-preencher (round-robin) — equipe atual',
    clear: 'Limpar alocações',
    save: 'Salvar (local)',
    export: 'Exportar JSON',
    import: 'Importar JSON',
    print: 'Imprimir',
    copy: 'Copiar resumo',
    schedule: 'Escala por Dia e Tarefa — ',
    select: '— Selecionar —',
    rule: 'Regra: a mesma pessoa não pode estar, no mesmo dia, em duas equipes/tarefas diferentes. Ao escolher, o sistema remove alocações conflitantes.',
    rolesAvail: 'Tarefas configuráveis por equipe.',
    tip: 'Dica: o JSON exportado pode ser reimportado depois para restaurar sua escala.',
    sundayMandatory: 'Domingo é obrigatório',
    confirmClear: 'Limpar todas as alocações?',
    existsName: 'Este nome já existe.',
  },
  es: {
    appTitle: 'Escala — Equipos de Medios',
    sundayFixed: 'El domingo es siempre obligatorio y fijo',
    branding: 'Branding (logo)',
    uploadLogo: 'Subir logo',
    removeLogo: 'Quitar logo',
    language: 'Idioma',
    configDays: 'Configuración de Días',
    days: { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo (fijo)' },
    teamConfig: 'Equipos y Tareas',
    addTeam: 'Añadir equipo',
    teamName: 'Nombre del equipo',
    roles: 'Tareas (separadas por comas)',
    update: 'Actualizar',
    remove: 'Quitar',
    teamTabs: 'Equipos',
    members: 'Miembros',
    addMemberPlaceholder: 'Agregar nombre',
    add: 'Agregar',
    actions: 'Acciones',
    autofill: 'Autocompletar (round-robin) — equipo actual',
    clear: 'Limpiar asignaciones',
    save: 'Guardar (local)',
    export: 'Exportar JSON',
    import: 'Importar JSON',
    print: 'Imprimir',
    copy: 'Copiar resumen',
    schedule: 'Escala por Día y Tarea — ',
    select: '— Seleccionar —',
    rule: 'Regla: la misma persona no puede estar, el mismo día, en dos equipos/tareas diferentes. Al elegir, el sistema elimina asignaciones en conflicto.',
    rolesAvail: 'Tareas configurables por equipo.',
    tip: 'Consejo: el JSON exportado puede reimportarse luego para restaurar tu escala.',
    sundayMandatory: 'El domingo es obligatorio',
    confirmClear: '¿Limpiar todas las asignaciones?',
    existsName: 'Ese nombre ya existe.',
  },
  en: {
    appTitle: 'Schedule — Media Teams',
    sundayFixed: 'Sunday is always mandatory and fixed',
    branding: 'Branding (logo)',
    uploadLogo: 'Upload logo',
    removeLogo: 'Remove logo',
    language: 'Language',
    configDays: 'Day Configuration',
    days: { monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday', thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday (fixed)' },
    teamConfig: 'Teams & Tasks',
    addTeam: 'Add team',
    teamName: 'Team name',
    roles: 'Tasks (comma separated)',
    update: 'Update',
    remove: 'Remove',
    teamTabs: 'Teams',
    members: 'Members',
    addMemberPlaceholder: 'Add name',
    add: 'Add',
    actions: 'Actions',
    autofill: 'Auto-fill (round-robin) — current team',
    clear: 'Clear assignments',
    save: 'Save (local)',
    export: 'Export JSON',
    import: 'Import JSON',
    print: 'Print',
    copy: 'Copy summary',
    schedule: 'Schedule by Day & Task — ',
    select: '— Select —',
    rule: 'Rule: the same person cannot be, on the same day, in two different teams/tasks. Selecting clears conflicting assignments.',
    rolesAvail: 'Tasks are configurable per team.',
    tip: 'Tip: The exported JSON can be re-imported later to restore your schedule.',
    sundayMandatory: 'Sunday is mandatory',
    confirmClear: 'Clear all assignments?',
    existsName: 'This name already exists.',
  }
}
const WEEK_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const STORAGE_KEY = 'escala_midia_multi_team_v1'

function uid(){ return Math.random().toString(36).slice(2,9) }

export default function App(){
  const [lang,setLang] = useState('pt')
  const t = I18N[lang]

  const [logo, setLogo] = useState('/logo.png')
  const [members,setMembers] = useState(['Alice','Bruno','Camila','Diego'])
  const [newMember,setNewMember] = useState('')

  // Teams with configurable roles
  const [teams,setTeams] = useState([
    { id: uid(), name: 'Mídia', roles: ['Front','Livestream','Câmeras'] }
  ])
  const [activeTeamId,setActiveTeamId] = useState(null)

  // Days active (global)
  const [daysActive,setDaysActive] = useState({
    monday:true, tuesday:true, wednesday:true, thursday:true, friday:true, saturday:false, sunday:true
  })

  // schedule[day][teamId][role] = member
  const [schedule,setSchedule] = useState(() => {
    const base = {}
    WEEK_KEYS.forEach(d=> base[d]={})
    return base
  })

  useEffect(()=>{
    const raw = localStorage.getItem(STORAGE_KEY)
    if(raw){
      try{
        const parsed = JSON.parse(raw)
        if(parsed.lang) setLang(parsed.lang)
        if(parsed.logo) setLogo(parsed.logo)
        if(parsed.members) setMembers(parsed.members)
        if(parsed.teams) setTeams(parsed.teams)
        if(parsed.daysActive) setDaysActive({ ...parsed.daysActive, sunday:true })
        if(parsed.schedule) setSchedule(parsed.schedule)
        if(parsed.activeTeamId) setActiveTeamId(parsed.activeTeamId)
      }catch{}
    }else{
      setActiveTeamId((prev)=> prev ?? (teams[0]?.id || null))
    }
  },[])

  useEffect(()=>{
    if(activeTeamId===null && teams.length){ setActiveTeamId(teams[0].id) }
  },[teams,activeTeamId])

  function save(){
    const data = { lang, logo, members, teams, daysActive:{...daysActive,sunday:true}, schedule, activeTeamId }
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      alert(lang==='pt'?'Escala salva.':lang==='es'?'Escala guardada.':'Schedule saved.')
    }catch{}
  }

  function clearAll(){
    if(!confirm(t.confirmClear)) return
    const cleared = {}
    WEEK_KEYS.forEach(d=> cleared[d]={})
    setSchedule(cleared)
  }

  function exportJSON(){
    const blob = new Blob([JSON.stringify({ lang, logo, members, teams, daysActive:{...daysActive,sunday:true}, schedule }, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'escala-midia.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJSON(file){
    const reader = new FileReader()
    reader.onload = ()=>{
      try{
        const parsed = JSON.parse(String(reader.result))
        if(parsed.lang) setLang(parsed.lang)
        if(parsed.logo) setLogo(parsed.logo)
        if(parsed.members) setMembers(parsed.members)
        if(parsed.teams) setTeams(parsed.teams)
        if(parsed.daysActive) setDaysActive({ ...parsed.daysActive, sunday:true })
        if(parsed.schedule) setSchedule(parsed.schedule)
      }catch{ alert('Invalid file.') }
    }
    reader.readAsText(file)
  }

  function onLogoUpload(file){
    const reader = new FileReader()
    reader.onload = ()=> setLogo(String(reader.result))
    reader.readAsDataURL(file)
  }

  function addMember(){
    const n = newMember.trim()
    if(!n) return
    if(members.includes(n)){ alert(t.existsName); return }
    setMembers([...members,n])
    setNewMember('')
  }

  function removeMember(name){
    setMembers(members.filter(m=>m!==name))
    // remove assignments for this member
    setSchedule(prev=>{
      const clone = structuredClone(prev)
      WEEK_KEYS.forEach(d=>{
        for(const teamId of Object.keys(clone[d]||{})){
          for(const role of Object.keys(clone[d][teamId]||{})){
            if(clone[d][teamId][role]===name) clone[d][teamId][role]=''
          }
        }
      })
      return clone
    })
  }

  function addTeam(){
    const id = uid()
    setTeams([...teams, { id, name: 'Nova Equipe', roles: ['Papel A','Papel B'] }])
    setActiveTeamId(id)
  }

  function updateTeam(id, name, rolesCsv){
    const roles = rolesCsv.split(',').map(s=>s.trim()).filter(Boolean)
    setTeams(teams.map(t=> t.id===id ? { ...t, name, roles } : t))
    // ensure schedule has entries for new roles (no need for explicit init thanks to dynamic set)
  }

  function removeTeam(id){
    setTeams(teams.filter(t=> t.id!==id))
    setSchedule(prev=>{
      const clone = structuredClone(prev)
      WEEK_KEYS.forEach(d=>{
        if(clone[d] && clone[d][id]) delete clone[d][id]
      })
      return clone
    })
    if(activeTeamId===id){
      const next = teams.find(t=>t.id!==id)?.id || null
      setActiveTeamId(next)
    }
  }

  // Core rule: same person cannot be assigned on the same day across different teams/roles
  function assign(day, teamId, role, name){
    setSchedule(prev=>{
      const clone = structuredClone(prev)
      clone[day] = clone[day] || {}
      clone[day][teamId] = clone[day][teamId] || {}

      // Remove person from ALL other teams/roles on that day
      for(const tId of Object.keys(clone[day])){
        for(const r of Object.keys(clone[day][tId])){
          if(clone[day][tId][r] === name){
            clone[day][tId][r] = ''
          }
        }
      }
      clone[day][teamId][role] = name
      return clone
    })
  }

  function autoFillCurrentTeam(){
    const team = teams.find(t=>t.id===activeTeamId)
    if(!team || members.length===0) return
    let idx=0
    setSchedule(prev=>{
      const clone = structuredClone(prev)
      WEEK_KEYS.filter(d=>daysActive[d]).forEach(day=>{
        clone[day] = clone[day] || {}
        clone[day][team.id] = clone[day][team.id] || {}
        team.roles.forEach(role=>{
          const name = members[idx % members.length]
          // apply uniqueness: clear same person anywhere that day first
          for(const tId of Object.keys(clone[day])){
            for(const r of Object.keys(clone[day][tId])){
              if(clone[day][tId][r]===name) clone[day][tId][r]=''
            }
          }
          clone[day][team.id][role] = name
          idx++
        })
      })
      return clone
    })
  }

  const summaryText = useMemo(()=>{
    const lines = []
    WEEK_KEYS.filter(d=>daysActive[d]).forEach(day=>{
      const dayLabel = I18N[lang].days[day]
      const parts = []
      for(const team of teams){
        const roles = team.roles.map(r=> `${r}: ${(schedule[day]?.[team.id]?.[r]||'—')}`).join(' | ')
        parts.push(`${team.name} [${roles}]`)
      }
      lines.push(`${dayLabel}: ${parts.join(' || ')}`)
    })
    return lines.join('\n')
  },[schedule,daysActive,teams,lang])

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

        {/* Days config & team config */}
        <div className="section grid grid-3">
          <div className="panel">
            <b>{t.configDays}</b>
            <div className="section hstack wrap">
              {WEEK_KEYS.map(key=>{
                const isSunday = key==='sunday'
                const active = !!daysActive[key]
                return (
                  <button key={key}
                    className="badge"
                    onClick={()=>{ if(isSunday) return; setDaysActive({...daysActive, [key]:!active}) }}
                    title={isSunday? t.sundayMandatory : ''}
                    style={{opacity: isSunday? .8 : 1, background: active? 'var(--accent)' : ''}}
                  >
                    {t.days[key]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="panel" style={{gridColumn:'span 2'}}>
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
                    <button onClick={()=>removeTeam(team.id)}>{t.remove}</button>
                  </div>
                )
              })}
            </div>
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
                  <button onClick={()=>removeMember(m)}>{I18N[lang].remove}</button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{gridColumn:'span 2'}}>
            <b>{t.actions}</b>
            <div className="section hstack wrap" style={{gap:8}}>
              <button onClick={autoFillCurrentTeam}>{t.autofill}</button>
              <button onClick={clearAll}>{t.clear}</button>
              <button onClick={save}>{t.save}</button>
              <button onClick={exportJSON}>{t.export}</button>
              <label className="file">
                <input type="file" accept="application/json" style={{display:'none'}} onChange={(e)=> e.target.files?.[0] && importJSON(e.target.files[0]) }/>
                <span>{t.import}</span>
              </label>
              <button onClick={()=>window.print()}>{t.print}</button>
              <button onClick={()=>{ navigator.clipboard.writeText(summaryText); alert('OK') }}>{t.copy}</button>
            </div>

            {/* Team tabs */}
            <div className="section">
              <div className="tabbar">
                {teams.map(team=>(
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
                        <th>Dia</th>
                        {team.roles.map(r=> <th key={r}>{r}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {WEEK_KEYS.filter(d=>daysActive[d]).map(day=> (
                        <tr key={day}>
                          <td>{t.days[day]}</td>
                          {team.roles.map(role=> (
                            <td key={role}>
                              <select
                                value={(schedule[day]?.[team.id]?.[role])||''}
                                onChange={e=> assign(day, team.id, role, e.target.value) }
                              >
                                <option value="">{t.select}</option>
                                {members.map(m=> <option key={m} value={m}>{m}</option>)}
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
            ))}
          </div>
        </div>

        {/* Summary */}
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
