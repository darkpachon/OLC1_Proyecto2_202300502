export class Environment {
  constructor(parent = null, interpreter = null) {
    this.vars = new Map();
    this.parent = parent;
    this.interpreter = interpreter || parent?.interpreter;
  }

  declare(name, value, type, line, col) {
    if (this.vars.has(name)) {
      throw { kind: 'Semántico', code: 'SEM-001', desc: `Variable '${name}' ya declarada en este ámbito`, line, col };
    }
    this.vars.set(name, { value, type });
  }

  assign(name, value, line, col) {
    let e = this;
    while (e) {
      if (e.vars.has(name)) { e.vars.get(name).value = value; return; }
      e = e.parent;
    }
    throw { kind: 'Semántico', code: 'SEM-003', desc: `Variable '${name}' no declarada`, line, col };
  }

  get(name) {
    let e = this;
    while (e) {
      if (e.vars.has(name)) return e.vars.get(name);
      e = e.parent;
    }
    return undefined;
  }

  getSnapshot(scope = 'global') {
    const arr = [];
    for (const [k, v] of this.vars) {
      let display = v.value;
      let categoria = 'variable';

      if (v.value && v.value.__kind) {
        categoria = 'recurso';
        display = `<${v.value.__kind} ${v.value.name} (${v.value.status})>`;
      } else if (Array.isArray(v.value)) {
        display = '[' + v.value.map((x) => {
          if (x && x.__kind) return `<${x.__kind} ${x.name}>`;
          if (typeof x === 'string') return `"${x}"`;
          return String(x);
        }).join(', ') + ']';
      }

      arr.push({ name: k, categoria, type: v.type, scope, value: display });
    }
    if (this.parent) arr.push(...this.parent.getSnapshot(scope));
    return arr;
  }
}