// --- EXPRESIONES ---
export class LiteralExpr {
  constructor(v, t){ this.value=v; this.type=t; }
  evaluate(env){ return { value:this.value, type:this.type }; }
}

export class IdentifierExpr {
  constructor(name, line, col){ this.name=name; this.line=line; this.col=col; }
  evaluate(env){
    const r = env.get(this.name);
    if(r===undefined) throw { kind:'Semántico', code:'SEM-003', desc:`Variable '${this.name}' no declarada`, line:this.line, col:this.col };
    // Si es un recurso, exponer ref
    if(['server','service','database'].includes(r.type)){
      return { value: r.value, type: r.type, ref: r.value };
    }
    return r;
  }
}

export class BinaryExpr {
  constructor(op,l,r,line,col){ this.op=op; this.left=l; this.right=r; this.line=line; this.col=col; }
  evaluate(env){
    if(this.op==='&&'){ const L=this.left.evaluate(env); return { value: !!(L.value && this.right.evaluate(env).value), type:'bool' }; }
    if(this.op==='||'){ const L=this.left.evaluate(env); return { value: !!(L.value || this.right.evaluate(env).value), type:'bool' }; }
    const L=this.left.evaluate(env); const R=this.right.evaluate(env);
    const ops = {
      '+': (a,b)=>a+b, '-':(a,b)=>a-b, '*':(a,b)=>a*b,
      '/':(a,b)=>{ if(b===0) throw {kind:'Ejecución',code:'RUN-001',desc:'División por cero',line:this.line,col:this.col}; return a/b; },
      '%':(a,b)=>a%b,
      '==':(a,b)=>a===b, '!=':(a,b)=>a!==b,
      '<':(a,b)=>a<b, '>':(a,b)=>a>b, '<=':(a,b)=>a<=b, '>=':(a,b)=>a>=b
    };
    const fn = ops[this.op];
    if(!fn) throw {kind:'Ejecución',desc:`Operador desconocido ${this.op}`,line:this.line,col:this.col};
    let v = fn(L.value, R.value);
    let t='int';
    if(this.op==='+' && (L.type==='string'||R.type==='string')) t='string';
    else if(this.op==='+'||this.op==='-'||this.op==='*'||this.op==='/'||this.op==='%')
      t = (L.type==='float'||R.type==='float'||this.op==='/') ? 'float' : 'int';
    else t='bool';
    return { value:v, type:t };
  }
}

export class UnaryExpr {
  constructor(op,expr,line,col){ this.op=op; this.expr=expr; this.line=line; this.col=col; }
  evaluate(env){
    const r = this.expr.evaluate(env);
    if(this.op==='-') return { value:-r.value, type:r.type };
    if(this.op==='!') return { value:!r.value, type:'bool' };
  }
}

export class PropertyExpr {
  constructor(obj,prop,line,col){ this.obj=obj; this.prop=prop; this.line=line; this.col=col; }
  evaluate(env){
    const o = this.obj.evaluate(env);
    if(!o.ref) throw { kind:'Semántico', code:'SEM-006', desc:`Propiedad '${this.prop}' sobre valor no-recurso`, line:this.line, col:this.col };
    if(!(this.prop in o.ref)) throw { kind:'Semántico', code:'SEM-006', desc:`Propiedad '${this.prop}' no existe`, line:this.line, col:this.col };
    return { value: o.ref[this.prop], type: o.ref.__types?.[this.prop] || 'auto', ref:null };
  }
}

export class IndexExpr {
  constructor(obj,idx,line,col){ this.obj=obj; this.idx=idx; this.line=line; this.col=col; }
  evaluate(env){
    const o = this.obj.evaluate(env); const i = this.idx.evaluate(env);
    if(!Array.isArray(o.value)) throw { kind:'Semántico', desc:'Índice sobre valor no-arreglo', line:this.line, col:this.col };
    if(i.value<0 || i.value>=o.value.length) throw { kind:'Ejecución', desc:'Índice fuera de rango', line:this.line, col:this.col };
    return { value:o.value[i.value], type:o.elemType||'auto' };
  }
}

export class ArrayExpr {
  constructor(elems,line,col){ this.elems=elems; this.line=line; this.col=col; }
  evaluate(env){
    const vals = this.elems.map(e=>e.evaluate(env));
    return { value: vals.map(v=>v.value), type:'array', elemType: vals[0]?.type || 'auto' };
  }
}

export class CallExpr {
  constructor(name,args,line,col){ this.name=name; this.args=args; this.line=line; this.col=col; }
  evaluate(env){
    return env.interpreter.callFunction(this.name, this.args.map(a=>a.evaluate(env)), this.line, this.col);
  }
}

// --- INSTRUCCIONES ---
export class VarDecl {
  constructor(type, name, initExpr, line, col){
    this.type=type; this.name=name; this.init=initExpr; this.line=line; this.col=col;
  }
  execute(env){
    let val = { value: defaultValue(this.type), type:this.type };
    if(this.init){
      val = this.init.evaluate(env);
      if(!typeCompatible(this.type, val.type)){
        throw { kind:'Semántico', code:'SEM-004', desc:`No se puede asignar ${val.type} a variable ${this.type} '${this.name}'`, line:this.line, col:this.col };
      }
    }
    env.declare(this.name, val.value, this.type, this.line, this.col);
    return { signal:'NORMAL' };
  }
}

export class AssignStmt {
  constructor(target, expr, line, col){ this.target=target; this.expr=expr; this.line=line; this.col=col; }
  execute(env){
    const v = this.expr.evaluate(env);
    if(this.target instanceof IdentifierExpr){
      const cur = env.get(this.target.name);
      if(!cur) throw { kind:'Semántico', code:'SEM-003', desc:`Variable '${this.target.name}' no declarada`, line:this.line, col:this.col };
      if(!typeCompatible(cur.type, v.type)){
        throw { kind:'Semántico', code:'SEM-004', desc:`No se puede asignar ${v.type} a variable ${cur.type} '${this.target.name}'`, line:this.line, col:this.col };
      }
      env.assign(this.target.name, v.value, this.line, this.col);
    } else if(this.target instanceof PropertyExpr){
      const o = this.target.obj.evaluate(env);
      if(!o.ref) throw { kind:'Semántico', desc:'Asignación a propiedad de no-recurso', line:this.line, col:this.col };
      if(['status','host','packages'].includes(this.target.prop))
        throw { kind:'Semántico', code:'SEM-005', desc:`Propiedad '${this.target.prop}' es de solo lectura`, line:this.line, col:this.col };
      o.ref[this.target.prop] = v.value;
    } else if(this.target instanceof IndexExpr){
      const o = this.target.obj.evaluate(env); const i = this.target.idx.evaluate(env);
      o.value[i.value] = v.value;
    }
    return { signal:'NORMAL' };
  }
}

export class IfStmt {
  constructor(cond,thenB,elseB,line,col){ this.cond=cond; this.then=thenB; this.else=elseB; this.line=line; this.col=col; }
  execute(env){
    const c = this.cond.evaluate(env);
    if(c.type!=='bool') throw { kind:'Semántico', desc:'Condición if no es bool', line:this.line, col:this.col };
    const block = c.value ? this.then : this.else;
    if(block){ const inner = new (env.constructor)(env, env.interpreter); return runBlock(block, inner); }
    return { signal:'NORMAL' };
  }
}

export class WhileStmt {
  constructor(cond,body,line,col){ this.cond=cond; this.body=body; this.line=line; this.col=col; }
  execute(env){
    while(true){
      const c = this.cond.evaluate(env);
      if(c.type!=='bool') throw { kind:'Semántico', desc:'Condición while no es bool', line:this.line, col:this.col };
      if(!c.value) break;
      const inner = new (env.constructor)(env, env.interpreter);
      const prev = env.interpreter.inLoop;
      env.interpreter.inLoop = true;
      let sig;
      try { sig = runBlock(this.body, inner); }
      finally { env.interpreter.inLoop = prev; }
      if(sig.signal==='BREAK') break;
      if(sig.signal==='RETURN') return sig;
    }
    return { signal:'NORMAL' };
  }
}

export class ForStmt {
  constructor(init,cond,inc,body,line,col){ this.init=init;this.cond=cond;this.inc=inc;this.body=body;this.line=line;this.col=col; }
  execute(env){
    const outer = new (env.constructor)(env, env.interpreter);
    if(this.init) this.init.execute(outer);
    while(true){
      const c = this.cond.evaluate(outer);
      if(!c.value) break;
      const inner = new (env.constructor)(outer, env.interpreter);
      const prev = env.interpreter.inLoop;
      env.interpreter.inLoop = true;
      let sig;
      try { sig = runBlock(this.body, inner); }
      finally { env.interpreter.inLoop = prev; }
      if(sig.signal==='BREAK') break;
      if(sig.signal==='RETURN') return sig;
      if(this.inc) this.inc.execute(outer);
    }
    return { signal:'NORMAL' };
  }
}

export class BreakStmt {
  constructor(l,c){this.line=l;this.col=c;}
  execute(env){
    if(!env.interpreter.inLoop)
      throw { kind:'Semántico', code:'SEM-007', desc:'break fuera de un ciclo', line:this.line, col:this.col };
    return {signal:'BREAK'};
  }
}

export class ContinueStmt {
  constructor(l,c){this.line=l;this.col=c;}
  execute(env){
    if(!env.interpreter.inLoop)
      throw { kind:'Semántico', code:'SEM-007', desc:'continue fuera de un ciclo', line:this.line, col:this.col };
    return {signal:'CONTINUE'};
  }
}

export class ReturnStmt {
  constructor(expr,l,c){ this.expr=expr;this.line=l;this.col=c; }
  execute(env){
    if(!env.interpreter.inFunction)
      throw { kind:'Semántico', code:'SEM-007', desc:'return fuera de una función', line:this.line, col:this.col };
    const v = this.expr ? this.expr.evaluate(env) : { value:null, type:'void' };
    return { signal:'RETURN', value:v };
  }
}

export class ExprStmt {
  constructor(expr,l,c){ this.expr=expr;this.line=l;this.col=c; }
  execute(env){ this.expr.evaluate(env); return { signal:'NORMAL' }; }
}

export class RunStmt {
  constructor(name,l,c){ this.name=name;this.line=l;this.col=c; }
  execute(env){ return env.interpreter.runTask(this.name, this.line, this.col); }
}

export class Block {
  constructor(stmts){ this.stmts=stmts; }
  execute(env){ return runBlock(this.stmts, env); }
}

function runBlock(stmts, env){
  for(const s of stmts){
    env.interpreter.instructionCount++;
    if(env.interpreter.instructionCount > env.interpreter.maxInstructions){
      throw { kind:'Ejecución', code:'RUN-LIMIT', desc:'Límite de instrucciones excedido' };
    }
    const sig = s.execute(env);
    if(sig && (sig.signal==='BREAK'||sig.signal==='CONTINUE'||sig.signal==='RETURN')) return sig;
  }
  return { signal:'NORMAL' };
}

function defaultValue(type){
  switch(type){
    case 'int': return 0; case 'float': return 0.0;
    case 'string': return ''; case 'bool': return false;
    default: return null;
  }
}

function typeCompatible(dest, src){
  if(dest === src) return true;
  if(dest === 'float' && src === 'int') return true;
  if(dest && dest.endsWith('[]') && src === 'array') return true;
  if(src === 'null' || src === 'auto') return true;
  return false;
}