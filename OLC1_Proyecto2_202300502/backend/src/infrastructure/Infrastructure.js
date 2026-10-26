export class Infrastructure {
  constructor(){ this.resources = new Map(); this.bitacora = []; }
  log(msg, ok=true){ this.bitacora.push(`[${ok?'OK':'WARN'}] ${msg}`); }
  register(kind, name, props){
    const base = { __kind:kind, name, status:'stopped', __types:{} };
    if(kind==='server'){ base.packages=[]; base.__types.packages='string[]'; }
    if(kind==='service'){ base.host=null; base.status='undeployed'; }
    Object.assign(base, props);
    this.resources.set(name, base);
    this.log(`Resource '${name}' registered`);
  }
  get(name){ return this.resources.get(name); }
  all(){ return [...this.resources.values()]; }
}