import express from 'express';
import cors from 'cors';
import { Lexer } from './lexer/Lexer.js';
import { Parser } from './parser/Parser.js';
import { Interpreter } from './interpreter/Interpreter.js';
import { astToDot } from './reports/astDot.js';
import { renderDotToSvg } from './reports/astRenderer.js';
import * as AST from './ast/nodes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit:'2mb' }));

// Mapeo de nombres internos a nombres del enunciado (sección 17.1)
const TOKEN_DISPLAY = {
  STRING_T: 'STRING',
  STR: 'STRING_LITERAL',
  INT_LIT: 'INT_LITERAL',
  FLOAT_LIT: 'FLOAT_LITERAL',
  ID: 'IDENTIFIER',
  // los demás ya coinciden con el formato del PDF
};

function displayTokenName(t){
  return TOKEN_DISPLAY[t] || t;
}

function fmtError(e){
  if(!e) return { type:'Interno', desc:'Error desconocido' };
  if(typeof e === 'string') return { type:'Interno', desc:e };
  return {
    type: e.kind || e.type || 'Interno',
    code: e.code,
    desc: e.desc || e.message || String(e),
    line: e.line,
    col:  e.col
  };
}

function dumpInfra(interp){
  return interp.infra.all().map(r=>({
    name:r.name, kind:r.__kind, status:r.status,
    cpu:r.cpu, memory:r.memory, disk:r.disk, os:r.os,
    port:r.port, replicas:r.replicas, host:r.host?.name || null,
    packages:r.packages
  }));
}

async function run(source){
  const lex = new Lexer(source).tokenize();
  if(lex.errors.length) {
    return {
      success:false,
      errors:lex.errors.map(fmtError),
      tokens: lex.tokens.map(t=>({ lexeme:t.lexeme, type: displayTokenName(t.type), line:t.line, col:t.col }))
    };
  }

  const parser = new Parser(lex.tokens);
  const prog = parser.parseProgram();
  if(parser.errors.length) {
    return {
      success:false,
      errors:parser.errors.map(fmtError),
      tokens: lex.tokens.map(t=>({ lexeme:t.lexeme, type: displayTokenName(t.type), line:t.line, col:t.col }))
    };
  }

  const interp = new Interpreter();

  // PASO A: registrar recursos vacíos
  for(const g of prog.globals){
    if(g.kind === 'ResourceDecl'){
      interp.infra.register(g.resource, g.name, {});
      interp.global.declare(g.name, interp.infra.get(g.name), g.resource);
    }
  }

  // PASO B: evaluar props
  for(const g of prog.globals){
    if(g.kind === 'ResourceDecl'){
      const ref = interp.infra.get(g.name);
      for(const [k, v] of Object.entries(g.props)){
        try {
          const val = v.evaluate(interp.global);
          ref[k] = val.ref || val.value;
          ref.__types[k] = val.type || 'auto';
        } catch(e){
          return {
            success:false,
            errors:[fmtError(e)],
            tokens: lex.tokens.map(t=>({ lexeme:t.lexeme, type: displayTokenName(t.type), line:t.line, col:t.col }))
          };
        }
      }
    }
  }

  // PASO C: funciones, tasks, variables globales
  for(const g of prog.globals){
    try {
      if(g.kind === 'FunctionDecl'){
        interp.registerFunction(g.name, g.params, g.retType, g.body, interp.global);
      } else if(g.kind === 'TaskDecl'){
        interp.registerTask(g.name, g.body, interp.global);
      } else if(g instanceof AST.VarDecl){
        g.execute(interp.global);
      }
    } catch(e){
      return {
        success:false,
        errors:[fmtError(e)],
        tokens: lex.tokens.map(t=>({ lexeme:t.lexeme, type: displayTokenName(t.type), line:t.line, col:t.col }))
      };
    }
  }

  for(const r of interp.infra.all()){
    if(Array.isArray(r.dependsOn)){
      r.dependsOn = r.dependsOn.map(x => typeof x === 'string' ? interp.infra.get(x) : x);
    }
  }

  if(!prog.main) {
    return {
      success:false,
      errors:[{ type:'Semántico', desc:'No existe bloque main', line:0, col:0 }],
      tokens: lex.tokens.map(t=>({ lexeme:t.lexeme, type: displayTokenName(t.type), line:t.line, col:t.col }))
    };
  }
  interp.setMain(prog.main.body);

  // Generar AST (DOT + SVG)
  let astDot = null, astSvg = null, astError = null;
  try {
    astDot = astToDot(prog);
    try {
      astSvg = await renderDotToSvg(astDot);
    } catch(e){
      astError = 'Error renderizando SVG: ' + (e.message || String(e));
    }
  } catch(e){
    astError = 'Error generando DOT: ' + (e.message || String(e));
  }

  // Ejecutar main
  let response;
  const tokensOut = lex.tokens.map(t=>({ lexeme:t.lexeme, type: displayTokenName(t.type), line:t.line, col:t.col }));

  try {
    interp.runMain();
    response = {
      success:true,
      errors:[],
      tokens: tokensOut,
      console: interp.console,
      symbols: interp.getAllSymbols(),
      infrastructure: dumpInfra(interp),
      bitacora: interp.infra.bitacora
    };
  } catch(e){
    response = {
      success:false,
      errors:[fmtError(e)],
      console: interp.console,
      tokens: tokensOut,
      bitacora: interp.infra.bitacora,
      infrastructure: dumpInfra(interp),
      symbols: interp.getAllSymbols()
    };
  }

  response.astDot = astDot;
  response.astSvg = astSvg;
  if(astError) response.astError = astError;

  return response;
}

app.get('/api/health', (_q,res)=>res.json({ ok:true }));

app.post('/api/execute', async (req,res)=>{
  try { res.json(await run(req.body.source || '')); }
  catch(e){ res.json({ success:false, errors:[fmtError(e)] }); }
});

app.post('/api/analyze', async (req,res)=>{
  try { res.json(await run(req.body.source || '')); }
  catch(e){ res.json({ success:false, errors:[fmtError(e)] }); }
});

app.post('/api/tokens', (req,res)=>{
  try {
    const l = new Lexer(req.body.source || '').tokenize();
    const tokens = l.tokens.map(t=>({ lexeme:t.lexeme, type: displayTokenName(t.type), line:t.line, col:t.col }));
    res.json({ tokens, errors:l.errors });
  } catch(e){
    res.json({ tokens:[], errors:[fmtError(e)] });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=>console.log(`AutoInfra backend en http://localhost:${PORT}`));