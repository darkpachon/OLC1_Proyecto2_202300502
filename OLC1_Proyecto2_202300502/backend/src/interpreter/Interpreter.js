import { Environment } from '../environment/Environment.js';
import { Infrastructure } from '../infrastructure/Infrastructure.js';

export class Interpreter {
  constructor(){
    this.global = new Environment(null, this);
    this.infra = new Infrastructure();
    this.functions = new Map();
    this.tasks = new Map();
    this.mainBody = null;
    this.instructionCount = 0;
    this.maxInstructions = 100000;
    this.console = [];
    this.inLoop = false;
    this.inFunction = false;
  }

  registerFunction(name, params, retType, body, env){ this.functions.set(name, {params, retType, body, env}); }
  registerTask(name, body, env){ this.tasks.set(name, {body, env}); }
  setMain(body){ this.mainBody = body; }

  // ---- Tabla de símbolos COMPLETA (variables + funciones + tasks) ----
  getAllSymbols(){
    const arr = this.global.getSnapshot('global');

    for (const [name, fn] of this.functions) {
      const sig = fn.params.map(p => `${p.type} ${p.name}`).join(', ');
      const ret = fn.retType || 'void';
      arr.push({
        name,
        categoria: 'función',
        type: ret,
        scope: 'global',
        value: `f(${sig}) → ${ret}`
      });
    }

    for (const [name] of this.tasks) {
      arr.push({
        name,
        categoria: 'task',
        type: 'task',
        scope: 'global',
        value: 'task()'
      });
    }

    return arr;
  }

  callFunction(name, argValues, line, col){
    const native = this.natives[name];
    if(native) return native.call(this, argValues, line, col);

    const fn = this.functions.get(name);
    if(!fn) throw { kind:'Semántico', code:'SEM-005', desc:`Función '${name}' no definida`, line, col };
    if(argValues.length !== fn.params.length)
      throw { kind:'Semántico', code:'SEM-008', desc:`Firma incorrecta al llamar '${name}'`, line, col };

    const local = new Environment(fn.env, this);
    fn.params.forEach((p,i)=>{
      const v = argValues[i];
      if(!this.typeCompatible(p.type, v.type))
        throw { kind:'Semántico', code:'SEM-004', desc:`Tipo de argumento ${i+1} incompatible en '${name}'`, line, col };
      local.declare(p.name, v.value, p.type, line, col);
      // marcar la categoría del parámetro en el snapshot
      const stored = local.vars.get(p.name);
      if(stored) stored.categoria = 'parámetro';
    });

    const prevInFunc = this.inFunction;
    const prevInLoop = this.inLoop;
    this.inFunction = true;
    this.inLoop = false;

    let sig;
    try { sig = this.runStatements(fn.body, local); }
    finally { this.inFunction = prevInFunc; this.inLoop = prevInLoop; }

    if(sig.signal === 'RETURN') return { value: sig.value.value, type: sig.value.type };
    if(fn.retType && fn.retType !== 'void')
      throw { kind:'Semántico', code:'SEM-009', desc:`Función '${name}' debe retornar ${fn.retType}`, line, col };
    return { value:null, type:'void' };
  }

  runTask(name, line, col){
    const t = this.tasks.get(name);
    if(!t) throw { kind:'Semántico', code:'SEM-010', desc:`Task '${name}' no definida`, line, col };
    const local = new Environment(t.env, this);
    const prevInLoop = this.inLoop;
    const prevInFunc = this.inFunction;
    this.inLoop = false;
    this.inFunction = false;
    try { return this.runStatements(t.body, local); }
    finally { this.inLoop = prevInLoop; this.inFunction = prevInFunc; }
  }

  runStatements(body, env){
    for(const s of body){
      this.instructionCount++;
      if(this.instructionCount > this.maxInstructions)
        throw { kind:'Ejecución', code:'RUN-LIMIT', desc:'Límite de instrucciones excedido' };
      const sig = s.execute(env);
      if(sig && sig.signal !== 'NORMAL') return sig;
    }
    return { signal:'NORMAL' };
  }

  runMain(){
    if(!this.mainBody) throw { kind:'Semántico', desc:'No existe bloque main' };
    this.runStatements(this.mainBody, this.global);
  }

  typeCompatible(dest, src){
    if(dest===src) return true;
    if(dest==='float' && src==='int') return true;
    if(dest.endsWith('[]') && src==='array') return true;
    if(src==='null' || src==='auto') return true;
    return false;
  }

  natives = {
    start: (args, line, col)=>{
      const r = args[0].ref; if(!r) throw { kind:'Semántico', desc:'start requiere recurso' };
      if(r.status==='running'){ this.infra.log(`start(${r.name}) ya activo`, false); return { value:false, type:'bool' }; }
      r.status='running'; this.infra.log(`${r.name} started`);
      return { value:true, type:'bool' };
    },
    stop: (args)=>{
      const r = args[0].ref;
      if(r.status!=='running'){ this.infra.log(`stop(${r.name}) ya detenido`, false); return { value:false, type:'bool' }; }
      r.status='stopped'; this.infra.log(`${r.name} stopped`); return { value:true, type:'bool' };
    },
    restart: (args)=>{
      const r = args[0].ref;
      if(r.status!=='running') return { value:false, type:'bool' };
      this.infra.log(`${r.name} restarted`); return { value:true, type:'bool' };
    },
    install: (args)=>{
      const r = args[0].ref; const pkg = args[1].value;
      if(r.status!=='running') throw { kind:'Infraestructura', code:'INFRA-001', desc:`No se puede instalar en '${r.name}' detenido` };
      if(!r.packages.includes(pkg)){ r.packages.push(pkg); this.infra.log(`${pkg} installed on ${r.name}`); }
      return { value:true, type:'bool' };
    },
    uninstall: (args)=>{
      const r = args[0].ref; const pkg = args[1].value;
      r.packages = r.packages.filter(p=>p!==pkg);
      this.infra.log(`${pkg} uninstalled from ${r.name}`); return { value:true, type:'bool' };
    },
    deploy: (args, line, col)=>{
      const s = args[0].ref; const svc = args[1].ref;
      if(s.status!=='running') throw { kind:'Infraestructura', code:'INFRA-002', desc:`No se puede desplegar en '${s.name}' detenido` };
      if(svc.dependsOn){
        for(const d of svc.dependsOn){
          if(d && d.status!=='running') throw { kind:'Infraestructura', code:'INFRA-004',
            desc:`No se puede desplegar '${svc.name}'. Dependencia '${d.name}' se encuentra en estado ${d.status}`, line, col };
        }
      }
      svc.host = s; svc.status='running';
      this.infra.log(`${svc.name} deployed on ${s.name}`);
      return { value:true, type:'bool' };
    },
    scale: (args)=>{
      const svc = args[0].ref; const n = args[1].value;
      if(n<1) throw { kind:'Infraestructura', code:'INFRA-005', desc:'scale requiere al menos 1 réplica' };
      const prev = svc.replicas; svc.replicas = n;
      this.infra.log(`${svc.name} scaled from ${prev} to ${n} replicas`);
      return { value:true, type:'bool' };
    },
    connect: (args)=>{ this.infra.log(`${args[0].ref.name} <-> ${args[1].ref.name}`); return { value:true, type:'bool' }; },
    disconnect: (args)=>{ this.infra.log(`disconnect ${args[0].ref.name}`); return { value:true, type:'bool' }; },
    print: (args)=>{
      const s = args.map(a=>a.value).join(' ');
      this.console.push(s); return { value:null, type:'void' };
    },
    length: (args)=>{
      const v = args[0].value;
      return { value: Array.isArray(v) ? v.length : (typeof v === 'string' ? v.length : 0), type:'int' };
    },
    status: (args)=>{ return { value: args[0].ref?.status || '', type:'string' }; }
  };
}