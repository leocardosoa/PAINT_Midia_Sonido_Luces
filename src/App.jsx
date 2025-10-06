import React, { useState, useEffect } from 'react'
import { supa } from './lib/supa'

function buildTeamOptionGroups(teamId, members){
  const inTeam = members.filter(m=> Array.isArray(m.teams) && m.teams.includes(teamId)).map(m=>m.name).sort((a,b)=>a.localeCompare(b))
  const others = members.filter(m=> !Array.isArray(m.teams) || !m.teams.includes(teamId)).map(m=>m.name).sort((a,b)=>a.localeCompare(b))
  return { inTeam, others }
}

export default function App(){
  const [teams,setTeams]=useState([{id:'1',name:'Mídia',roles:['Front','Livestream','Câmeras']}])
  const [members,setMembers]=useState([{name:'Alice',teams:['1']},{name:'Bruno',teams:[]},{name:'Camila',teams:['1']},{name:'Diego',teams:[]}])
  const [selectedDates,setSelectedDates]=useState(['2025-10-12'])
  const [schedule,setSchedule]=useState({})
  const [space,setSpace]=useState('demo')
  const [status,setStatus]=useState('')

  useEffect(()=>{ if(!supa){setStatus('Sem Supabase');return;} setStatus('Conectando...') },[])

  return(<div style={{padding:20}}>
    <h1>Escala — Equipes (Supabase)</h1>
    <p>{status}</p>
    <h2>Membros</h2>
    {[...members].sort((a,b)=>a.name.localeCompare(b.name)).map(m=>
      <div key={m.name}>{m.name} — Equipes: {m.teams.join(', ')||'nenhuma'}</div>
    )}
    <h2>Escala por Data</h2>
    <table>
      <thead><tr><th>Data</th><th>Equipe</th><th>Função</th><th>Membro</th></tr></thead>
      <tbody>
      {selectedDates.map(d=>
        teams.map(t=>
          t.roles.map(r=>{
            const g=buildTeamOptionGroups(t.id,members)
            return <tr key={d+t.id+r}>
              <td>{d}</td><td>{t.name}</td><td>{r}</td>
              <td>
                <select>
                  <option value=''>— Selecionar —</option>
                  {g.inTeam.length>0 && <optgroup label='Da equipe'>{g.inTeam.map(n=><option key={n}>{n}</option>)}</optgroup>}
                  {g.others.length>0 && <optgroup label='Outros'>{g.others.map(n=><option key={n}>{n}</option>)}</optgroup>}
                </select>
              </td>
            </tr>
          })
        )
      )}
      </tbody>
    </table>
  </div>)
}
