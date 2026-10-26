import { useState, useRef } from 'react';
import { execute } from './api';

const SAMPLE = `server backend { cpu = 4; memory = 8; disk = 100; os = "ubuntu"; }
database postgres { engine = "postgresql"; version = "16"; port = 5432; }
service api { port = 8080; replicas = 2; dependsOn = [postgres]; }

task production {
  start(postgres);
  start(backend);
  install(backend, "docker");
  deploy(backend, api);
  scale(api, 3);
  print("API lista en " + api.port);
}

main { run production; }
`;

export default function App(){
  const [code, setCode] = useState(SAMPLE);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('consola');
  const [fileName, setFileName] = useState('sin_titulo.infra');
  const fileInputRef = useRef(null);

  function nuevoArchivo(){
    if(!confirm('¿Descartar el contenido actual y crear un archivo nuevo?')) return;
    setCode(''); setFileName('sin_titulo.infra'); setResult(null); setTab('consola');
  }
  function abrirArchivo(){ fileInputRef.current?.click(); }
  function onFileSelected(e){
    const file = e.target.files?.[0]; if(!file) return;
    if(!file.name.endsWith('.infra')){ alert('Solo se permiten archivos .infra'); return; }
    const reader = new FileReader();
    reader.onload = (ev)=>{ setCode(ev.target.result); setFileName(file.name); setResult(null); setTab('consola'); };
    reader.readAsText(file);
    e.target.value = '';
  }
  function guardar(){
    let nombre = fileName;
    if(!nombre || nombre === 'sin_titulo.infra'){
      nombre = prompt('Nombre del archivo:', 'mi_infraestructura.infra');
      if(!nombre) return;
      if(!nombre.endsWith('.infra')) nombre += '.infra';
      setFileName(nombre);
    }
    descargar(code, nombre);
  }
  function guardarComo(){
    let nombre = prompt('Guardar como:', fileName || 'mi_infraestructura.infra');
    if(!nombre) return;
    if(!nombre.endsWith('.infra')) nombre += '.infra';
    setFileName(nombre);
    descargar(code, nombre);
  }
  function descargar(contenido, nombre){
    const blob = new Blob([contenido], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function onRun(){
    setLoading(true);
    try { setResult(await execute(code)); }
    catch(e){ setResult({ success:false, errors:[{type:'Red',desc:String(e)}] }); }
    setLoading(false);
    setTab('consola');
  }
  function limpiar(){ setResult(null); setTab('consola'); }

  const tabs = [
    ['consola','📝 Consola'],
    ['infra','🖥️ Infraestructura'],
    ['errores','❌ Errores'],
    ['tokens','🔤 Tokens'],
    ['simbolos','📋 Símbolos'],
    ['bitacora','📜 Bitácora'],
    ['ast','🌳 AST'],
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', height:'100vh', fontFamily:'monospace', background:'#0d1117', color:'#e6edf3' }}>
      <input type="file" accept=".infra" ref={fileInputRef} onChange={onFileSelected} style={{ display:'none' }} />

      {/* Columna izquierda: editor */}
      <div style={{ display:'flex', flexDirection:'column', borderRight:'2px solid #30363d' }}>
        <div style={{ padding:8, background:'#161b22', display:'flex', gap:6, borderBottom:'1px solid #30363d', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color:'#58a6ff', fontSize:12, marginRight:8, padding:'2px 6px', background:'#0d1117', borderRadius:4, border:'1px solid #30363d' }}>
            📄 {fileName}
          </span>
          <button onClick={nuevoArchivo} style={btn} title="Nuevo archivo">🆕 Nuevo</button>
          <button onClick={abrirArchivo} style={btn} title="Abrir archivo .infra">📂 Abrir</button>
          <button onClick={guardar} style={btn} title="Guardar">💾 Guardar</button>
          <button onClick={guardarComo} style={btn} title="Guardar como…">💾📝 Guardar como</button>
          <span style={{ flex:1 }} />
          <button onClick={onRun} disabled={loading} style={{...btn, background:'#238636'}}>
            {loading ? '⏳ Ejecutando…' : '▶ Ejecutar'}
          </button>
          <button onClick={limpiar} style={btn}>🧹 Limpiar</button>
        </div>
        <textarea
          value={code}
          onChange={e=>setCode(e.target.value)}
          spellCheck={false}
          placeholder="Escribe tu código .infra aquí…"
          style={{ flex:1, padding:12, fontFamily:'monospace', fontSize:13, border:0, outline:'none', background:'#0d1117', color:'#e6edf3', resize:'none' }}
        />
      </div>

      {/* Columna derecha: pestañas */}
      <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', gap:0, background:'#161b22', borderBottom:'1px solid #30363d', overflowX:'auto' }}>
          {tabs.map(([k,label])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              padding:'8px 12px', border:0, background: tab===k?'#0d1117':'transparent',
              color: tab===k?'#58a6ff':'#8b949e', cursor:'pointer', fontSize:12,
              borderBottom: tab===k?'2px solid #58a6ff':'2px solid transparent',
              whiteSpace:'nowrap'
            }}>{label}</button>
          ))}
        </div>

        <div style={{ flex:1, overflow:'auto', padding:12 }}>
          {!result && <p style={{ color:'#8b949e' }}>Presiona ▶ Ejecutar</p>}

          {result && <>
            <div style={{ marginBottom:12, padding:8, borderRadius:6, background: result.success?'#12261e':'#2d1214', color: result.success?'#3fb950':'#f85149', fontWeight:'bold' }}>
              {result.success ? '✅ Ejecución exitosa' : '❌ Errores detectados'}
            </div>

            {tab === 'consola' && (
              result.console?.length
                ? <pre style={pre}>{result.console.join('\n')}</pre>
                : <p style={muted}>(sin salida de consola)</p>
            )}

            {tab === 'infra' && (
              result.infrastructure?.length
                ? <table style={table}>
                    <thead><tr><th style={th}>Nombre</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Detalles</th></tr></thead>
                    <tbody>
                      {result.infrastructure.map((r,i)=><tr key={i}>
                        <td style={td}>{r.name}</td>
                        <td style={td}>{r.kind}</td>
                        <td style={{...td, color: r.status==='running'?'#3fb950':'#f0883e'}}>{r.status}</td>
                        <td style={td}>
                          {[
                            r.cpu !== undefined && `cpu:${r.cpu}`,
                            r.memory !== undefined && `mem:${r.memory}`,
                            r.disk !== undefined && `disk:${r.disk}`,
                            r.os && `os:${r.os}`,
                            r.port && `port:${r.port}`,
                            r.replicas !== undefined && `replicas:${r.replicas}`,
                            r.host && `host:${r.host}`,
                            r.packages?.length && `pkg:[${r.packages.join(',')}]`,
                          ].filter(Boolean).join('  ')}
                        </td>
                      </tr>)}
                    </tbody>
                  </table>
                : <p style={muted}>(sin recursos)</p>
            )}

            {tab === 'errores' && (
              result.errors?.length
                ? <table style={table}>
                    <thead><tr><th style={th}>Tipo</th><th style={th}>Código</th><th style={th}>Descripción</th><th style={th}>Línea</th><th style={th}>Col</th></tr></thead>
                    <tbody>
                      {result.errors.map((e,i)=><tr key={i}>
                        <td style={td}>{e.type||e.kind}</td>
                        <td style={td}>{e.code||'-'}</td>
                        <td style={td}>{e.desc}</td>
                        <td style={td}>{e.line??'-'}</td>
                        <td style={td}>{e.col??'-'}</td>
                      </tr>)}
                    </tbody>
                  </table>
                : <p style={{color:'#3fb950'}}>✅ Sin errores</p>
            )}

            {tab === 'tokens' && (
              result.tokens?.length
                ? <table style={table}>
                    <thead><tr><th style={th}>#</th><th style={th}>Lexema</th><th style={th}>Token</th><th style={th}>Línea</th><th style={th}>Columna</th></tr></thead>
                    <tbody>
                      {result.tokens.map((t,i)=><tr key={i}>
                        <td style={td}>{i+1}</td>
                        <td style={td}>{t.lexeme}</td>
                        <td style={{...td, color:'#58a6ff'}}>{t.type}</td>
                        <td style={td}>{t.line}</td>
                        <td style={td}>{t.col}</td>
                      </tr>)}
                    </tbody>
                  </table>
                : <p style={muted}>(sin tokens)</p>
            )}

            {tab === 'simbolos' && (
              result.symbols?.length
                ? <table style={table}>
                    <thead><tr><th style={th}>Identificador</th><th style={th}>Categoría</th><th style={th}>Tipo</th><th style={th}>Ámbito</th><th style={th}>Valor / Estado</th></tr></thead>
                    <tbody>
                      {result.symbols.map((s,i)=><tr key={i}>
                        <td style={{...td, color:'#58a6ff'}}>{s.name}</td>
                        <td style={td}>
                          <span style={{
                            padding:'2px 6px', borderRadius:4, fontSize:11,
                            background:
                              s.categoria==='recurso' ? '#1f6feb33' :
                              s.categoria==='función' ? '#a371f733' :
                              s.categoria==='task'    ? '#f0883e33' :
                              s.categoria==='parámetro' ? '#3fb95033' :
                                                          '#8b949e33',
                            color:
                              s.categoria==='recurso' ? '#58a6ff' :
                              s.categoria==='función' ? '#c4a7ff' :
                              s.categoria==='task'    ? '#f0883e' :
                              s.categoria==='parámetro' ? '#3fb950' :
                                                          '#8b949e',
                          }}>{s.categoria || 'variable'}</span>
                        </td>
                        <td style={td}>{s.type}</td>
                        <td style={td}>{s.scope}</td>
                        <td style={td}>{String(s.value)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                : <p style={muted}>(sin símbolos)</p>
            )}

            {tab === 'bitacora' && (
              result.bitacora?.length
                ? <pre style={pre}>{result.bitacora.join('\n')}</pre>
                : <p style={muted}>(sin acciones registradas)</p>
            )}

            {tab === 'ast' && (
              <>
                {result.astSvg && (
                  <div style={{ background:'#fff', borderRadius:6, padding:8, overflow:'auto' }}
                       dangerouslySetInnerHTML={{ __html: result.astSvg }} />
                )}
                {!result.astSvg && result.astDot && <p style={{color:'#f0883e'}}>No se pudo renderizar SVG. Mostrando código DOT:</p>}
                {!result.astSvg && result.astDot && <pre style={pre}>{result.astDot}</pre>}
                {result.astError && <p style={{color:'#f85149'}}>{result.astError}</p>}
                {!result.astDot && <p style={muted}>(AST no disponible)</p>}
              </>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}

const btn = { padding:'6px 10px', background:'#21262d', color:'#e6edf3', border:'1px solid #30363d', borderRadius:6, cursor:'pointer', fontFamily:'monospace', fontSize:12 };
const pre = { background:'#161b22', padding:12, borderRadius:6, fontSize:12, overflow:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word', color:'#e6edf3' };
const muted = { color:'#8b949e' };
const table = { width:'100%', borderCollapse:'collapse', fontSize:12, background:'#161b22', borderRadius:6 };
const th = { padding:'6px 8px', textAlign:'left', background:'#21262d', color:'#58a6ff', borderBottom:'1px solid #30363d' };
const td = { padding:'6px 8px', borderBottom:'1px solid #21262d', verticalAlign:'top' };