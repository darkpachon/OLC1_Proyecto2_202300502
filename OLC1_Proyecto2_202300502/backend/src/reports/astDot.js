// Convierte el AST a formato DOT (Graphviz)
export function astToDot(prog){
  let nodeId = 0;
  const lines = [];
  const id = () => `n${nodeId++}`;

  function mkNode(label, shape='box', color='#1f6feb'){
    const nid = id();
    const safe = String(label).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    lines.push(`  ${nid} [label="${safe}", shape=${shape}, style="rounded,filled", fillcolor="${color}", fontcolor="white", fontname="Courier New", fontsize=10];`);
    return nid;
  }

  function edge(from, to){
    if(from && to) lines.push(`  ${from} -> ${to};`);
  }

  function walk(node){
    if(!node) return null;

    // Objetos planos con .kind (ResourceDecl, FunctionDecl, TaskDecl, Main)
    if(typeof node === 'object' && node.kind){
      switch(node.kind){
        case 'ResourceDecl': {
          const nid = mkNode(`${node.resource}\\n${node.name}`, 'box', '#2ea043');
          for(const [k,v] of Object.entries(node.props)){
            const pn = mkNode(k, 'box', '#58a6ff');
            edge(nid, pn);
            const c = walk(v); edge(pn, c);
          }
          return nid;
        }
        case 'FunctionDecl': {
          const nid = mkNode(`function\\n${node.name}`, 'box', '#a371f7');
          for(const p of node.params){
            const pn = mkNode(`${p.type} ${p.name}`, 'ellipse', '#a371f7');
            edge(nid, pn);
          }
          if(node.retType){
            const rn = mkNode(`→ ${node.retType}`, 'ellipse', '#a371f7');
            edge(nid, rn);
          }
          for(const s of node.body) edge(nid, walk(s));
          return nid;
        }
        case 'TaskDecl': {
          const nid = mkNode(`task\\n${node.name}`, 'box', '#f0883e');
          for(const s of node.body) edge(nid, walk(s));
          return nid;
        }
        case 'Main': {
          const nid = mkNode('main', 'box', '#f85149');
          for(const s of node.body) edge(nid, walk(s));
          return nid;
        }
      }
    }

    const t = node.constructor?.name;
    switch(t){
      case 'LiteralExpr':
        return mkNode(`${node.type}\\n${JSON.stringify(node.value)}`, 'ellipse', '#2ea043');
      case 'IdentifierExpr':
        return mkNode(`ID\\n${node.name}`, 'ellipse', '#a371f7');
      case 'BinaryExpr': {
        const nid = mkNode(`Op ${node.op}`, 'diamond', '#db6d28');
        edge(nid, walk(node.left));
        edge(nid, walk(node.right));
        return nid;
      }
      case 'UnaryExpr': {
        const nid = mkNode(`Op ${node.op}`, 'diamond', '#db6d28');
        edge(nid, walk(node.expr));
        return nid;
      }
      case 'PropertyExpr': {
        const nid = mkNode(`.${node.prop}`, 'box', '#8957e5');
        edge(nid, walk(node.obj));
        return nid;
      }
      case 'IndexExpr': {
        const nid = mkNode('[ ]', 'box', '#8957e5');
        edge(nid, walk(node.obj));
        edge(nid, walk(node.idx));
        return nid;
      }
      case 'ArrayExpr': {
        const nid = mkNode('Array', 'box', '#2ea043');
        for(const e of node.elems) edge(nid, walk(e));
        return nid;
      }
      case 'CallExpr': {
        const nid = mkNode(`call ${node.name}()`, 'box', '#f0883e');
        for(const a of node.args) edge(nid, walk(a));
        return nid;
      }
      case 'VarDecl': {
        const nid = mkNode(`${node.type} ${node.name}`, 'box', '#58a6ff');
        edge(nid, walk(node.init));
        return nid;
      }
      case 'AssignStmt': {
        const nid = mkNode('=', 'diamond', '#db6d28');
        edge(nid, walk(node.target));
        edge(nid, walk(node.expr));
        return nid;
      }
      case 'IfStmt': {
        const nid = mkNode('if', 'box', '#f85149');
        edge(nid, walk(node.cond));
        const thenN = mkNode('then', 'box', '#3fb950');
        edge(nid, thenN);
        for(const s of node.then) edge(thenN, walk(s));
        if(node.else){
          const elsN = mkNode('else', 'box', '#f85149');
          edge(nid, elsN);
          for(const s of node.else) edge(elsN, walk(s));
        }
        return nid;
      }
      case 'WhileStmt': {
        const nid = mkNode('while', 'box', '#f85149');
        edge(nid, walk(node.cond));
        const bodyN = mkNode('body', 'box', '#3fb950');
        edge(nid, bodyN);
        for(const s of node.body) edge(bodyN, walk(s));
        return nid;
      }
      case 'ForStmt': {
        const nid = mkNode('for', 'box', '#f85149');
        edge(nid, walk(node.init));
        edge(nid, walk(node.cond));
        edge(nid, walk(node.inc));
        const bodyN = mkNode('body', 'box', '#3fb950');
        edge(nid, bodyN);
        for(const s of node.body) edge(bodyN, walk(s));
        return nid;
      }
      case 'BreakStmt': return mkNode('break', 'box', '#f85149');
      case 'ContinueStmt': return mkNode('continue', 'box', '#f85149');
      case 'ReturnStmt': {
        const nid = mkNode('return', 'box', '#f0883e');
        edge(nid, walk(node.expr));
        return nid;
      }
      case 'ExprStmt': return walk(node.expr);
      case 'RunStmt': return mkNode(`run ${node.name}`, 'box', '#f0883e');
      case 'Block': {
        const nid = mkNode('block', 'box', '#8b949e');
        for(const s of node.stmts) edge(nid, walk(s));
        return nid;
      }
      default:
        return mkNode(t || 'Unknown', 'box', '#8b949e');
    }
  }

  lines.push('digraph AST {');
  lines.push('  rankdir=TB;');
  lines.push('  bgcolor="white";');
  lines.push('  node [fontname="Courier New", fontsize=10];');
  lines.push('  edge [color="#8b949e"];');

  const root = mkNode('Program', 'box', '#1f6feb');

  if(prog.globals && prog.globals.length){
    const globN = mkNode('Global Declarations', 'box', '#30363d');
    edge(root, globN);
    for(const g of prog.globals) edge(globN, walk(g));
  }

  if(prog.main) edge(root, walk(prog.main));

  lines.push('}');
  return lines.join('\n');
}