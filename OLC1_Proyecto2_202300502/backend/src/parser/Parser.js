import { TT } from '../lexer/Lexer.js';
import * as AST from '../ast/nodes.js';

export class Parser {
  constructor(tokens){ this.tokens=tokens; this.pos=0; this.errors=[]; }
  peek(o=0){ return this.tokens[this.pos+o]; }
  at(t){ return this.peek().type===t; }
  advance(){ return this.tokens[this.pos++]; }
  match(t){ if(this.at(t)){ this.advance(); return true; } return false; }
  expect(t, msg){
    if(this.at(t)) return this.advance();
    this.errors.push({ type:'Sintáctico', desc: msg||`Se esperaba ${t}, se encontró ${this.peek().type}`, line:this.peek().line, col:this.peek().col });
    return null;
  }
  sync(){ while(!this.at(TT.EOF) && !this.at(TT.SEMI) && !this.at(TT.RBRACE)) this.advance(); if(this.at(TT.SEMI)) this.advance(); }

  parseProgram(){
    const globals=[]; let main=null; let mainCount=0;
    while(!this.at(TT.EOF)){
      try{
        if(this.at(TT.SERVER)||this.at(TT.SERVICE)||this.at(TT.DATABASE)) globals.push(this.parseResource());
        else if(this.at(TT.FUNCTION)) globals.push(this.parseFunction());
        else if(this.at(TT.TASK)) globals.push(this.parseTask());
        else if(this.at(TT.MAIN)){
          mainCount++;
          if(mainCount > 1){
            this.errors.push({ type:'Semántico', code:'SEM-000', desc:'Solo puede existir un bloque main', line:this.peek().line, col:this.peek().col });
          }
          main = this.parseMain();
        }
        else if(this.at(TT.INT)||this.at(TT.FLOAT)||this.at(TT.STRING_T)||this.at(TT.BOOL)) globals.push(this.parseVarDecl());
        else { this.errors.push({type:'Sintáctico',desc:`Token inesperado ${this.peek().type}`,line:this.peek().line,col:this.peek().col}); this.sync(); }
      } catch(e){ this.errors.push(e); this.sync(); }
    }
    return { globals, main, errors:this.errors };
  }

  parseType(){
    const t=this.advance();
    let name = t.lexeme;
    if(this.match(TT.LBRACKET)){ this.expect(TT.RBRACKET); name += '[]'; }
    return name;
  }

  parseResource(){
    const kind=this.advance().lexeme;
    const name=this.expect(TT.ID).lexeme;
    this.expect(TT.LBRACE);
    const props={};
    while(!this.at(TT.RBRACE) && !this.at(TT.EOF)){
      const p = this.expect(TT.ID).lexeme;
      this.expect(TT.ASSIGN);
      const v = this.parseExpr();
      props[p] = v;
      this.match(TT.SEMI);
    }
    this.expect(TT.RBRACE);
    return { kind:'ResourceDecl', resource:kind, name, props };
  }

  parseFunction(){
    this.advance();
    const name = this.expect(TT.ID).lexeme;
    this.expect(TT.LPAREN);
    const params=[];
    if(!this.at(TT.RPAREN)){
      do {
        const type = this.parseType();
        const pname = this.expect(TT.ID).lexeme;
        params.push({ type, name:pname });
      } while(this.match(TT.COMMA));
    }
    this.expect(TT.RPAREN);
    let retType = null;
    if(this.at(TT.INT)||this.at(TT.FLOAT)||this.at(TT.STRING_T)||this.at(TT.BOOL)) retType = this.parseType();
    this.expect(TT.LBRACE);
    const body = this.parseBlockStatements();
    this.expect(TT.RBRACE);
    return { kind:'FunctionDecl', name, params, retType, body };
  }

  parseTask(){
    this.advance();
    const name = this.expect(TT.ID).lexeme;
    this.expect(TT.LBRACE);
    const body = this.parseBlockStatements();
    this.expect(TT.RBRACE);
    return { kind:'TaskDecl', name, body };
  }

  parseMain(){
    this.advance();
    this.expect(TT.LBRACE);
    const body = this.parseBlockStatements();
    this.expect(TT.RBRACE);
    return { kind:'Main', body };
  }

  parseBlockStatements(){
    const stmts=[];
    while(!this.at(TT.RBRACE) && !this.at(TT.EOF)){
      try{ stmts.push(this.parseStatement()); }
      catch(e){ this.errors.push(e); this.sync(); }
    }
    return stmts;
  }

  parseVarDecl(){
    const line = this.peek().line, col = this.peek().col;
    const type = this.parseType();
    const name = this.expect(TT.ID).lexeme;
    let init=null;
    if(this.match(TT.ASSIGN)) init = this.parseExpr();
    this.expect(TT.SEMI);
    return new AST.VarDecl(type, name, init, line, col);
  }

  parseStatement(){
    const t = this.peek();
    if(this.at(TT.INT)||this.at(TT.FLOAT)||this.at(TT.STRING_T)||this.at(TT.BOOL)) return this.parseVarDecl();
    if(this.at(TT.IF)) return this.parseIf();
    if(this.at(TT.WHILE)) return this.parseWhile();
    if(this.at(TT.FOR)) return this.parseFor();
    if(this.match(TT.BREAK)){ this.expect(TT.SEMI); return new AST.BreakStmt(t.line,t.col); }
    if(this.match(TT.CONTINUE)){ this.expect(TT.SEMI); return new AST.ContinueStmt(t.line,t.col); }
    if(this.match(TT.RETURN)){
      let e=null; if(!this.at(TT.SEMI)) e = this.parseExpr();
      this.expect(TT.SEMI); return new AST.ReturnStmt(e, t.line, t.col);
    }
    if(this.match(TT.RUN)){
      const name = this.expect(TT.ID).lexeme; this.expect(TT.SEMI);
      return new AST.RunStmt(name, t.line, t.col);
    }
    const expr = this.parseExpr();
    if(this.match(TT.ASSIGN)){
      const val = this.parseExpr(); this.expect(TT.SEMI);
      return new AST.AssignStmt(expr, val, t.line, t.col);
    }
    this.expect(TT.SEMI);
    return new AST.ExprStmt(expr, t.line, t.col);
  }

  parseIf(){
    const t = this.peek();
    this.advance(); this.expect(TT.LPAREN);
    const cond = this.parseExpr();
    this.expect(TT.RPAREN);
    this.expect(TT.LBRACE);
    const thenB = this.parseBlockStatements();
    this.expect(TT.RBRACE);
    let elseB = null;
    if(this.match(TT.ELSE)){
      if(this.at(TT.IF)){ elseB = [this.parseIf()]; }
      else {
        this.expect(TT.LBRACE);
        elseB = this.parseBlockStatements();
        this.expect(TT.RBRACE);
      }
    }
    return new AST.IfStmt(cond, thenB, elseB, t.line, t.col);
  }

  parseWhile(){
    const t = this.peek();
    this.advance(); this.expect(TT.LPAREN);
    const cond = this.parseExpr();
    this.expect(TT.RPAREN); this.expect(TT.LBRACE);
    const body = this.parseBlockStatements();
    this.expect(TT.RBRACE);
    return new AST.WhileStmt(cond, body, t.line, t.col);
  }

  parseFor(){
    const t = this.peek();
    this.advance(); this.expect(TT.LPAREN);

    // INIT
    let init = null;
    if(!this.at(TT.SEMI)){
      if(this.at(TT.INT)||this.at(TT.FLOAT)||this.at(TT.STRING_T)||this.at(TT.BOOL)){
        init = this.parseVarDecl();
      } else {
        const target = this.parseExpr();
        this.expect(TT.ASSIGN);
        const val = this.parseExpr();
        this.expect(TT.SEMI);
        init = new AST.AssignStmt(target, val, t.line, t.col);
      }
    } else {
      this.expect(TT.SEMI);
    }

    // COND
    const cond = this.parseExpr();
    this.expect(TT.SEMI);

    // INCREMENT
    const target = this.parseExpr();
    let inc;
    if(this.match(TT.ASSIGN)){
      const val = this.parseExpr();
      inc = new AST.AssignStmt(target, val, t.line, t.col);
    } else {
      inc = new AST.ExprStmt(target, t.line, t.col);
    }

    // BODY
    this.expect(TT.RPAREN); this.expect(TT.LBRACE);
    const body = this.parseBlockStatements();
    this.expect(TT.RBRACE);
    return new AST.ForStmt(init, cond, inc, body, t.line, t.col);
  }

  parseExpr(){ return this.parseOr(); }
  parseOr(){
    let l = this.parseAnd();
    while(this.at(TT.OR)){ const op=this.advance().lexeme; const r=this.parseAnd(); l=new AST.BinaryExpr(op,l,r,0,0); }
    return l;
  }
  parseAnd(){
    let l = this.parseEq();
    while(this.at(TT.AND)){ const op=this.advance().lexeme; const r=this.parseEq(); l=new AST.BinaryExpr(op,l,r,0,0); }
    return l;
  }
  parseEq(){
    let l = this.parseCmp();
    while(this.at(TT.EQ)||this.at(TT.NEQ)){ const op=this.advance().lexeme; const r=this.parseCmp(); l=new AST.BinaryExpr(op,l,r,0,0); }
    return l;
  }
  parseCmp(){
    let l = this.parseTerm();
    while(this.at(TT.LT)||this.at(TT.GT)||this.at(TT.LTE)||this.at(TT.GTE)){
      const op=this.advance().lexeme; const r=this.parseTerm(); l=new AST.BinaryExpr(op,l,r,0,0);
    }
    return l;
  }
  parseTerm(){
    let l = this.parseFactor();
    while(this.at(TT.PLUS)||this.at(TT.MINUS)){ const op=this.advance().lexeme; const r=this.parseFactor(); l=new AST.BinaryExpr(op,l,r,0,0); }
    return l;
  }
  parseFactor(){
    let l = this.parseUnary();
    while(this.at(TT.STAR)||this.at(TT.SLASH)||this.at(TT.PERCENT)){ const op=this.advance().lexeme; const r=this.parseUnary(); l=new AST.BinaryExpr(op,l,r,0,0); }
    return l;
  }
  parseUnary(){
    if(this.at(TT.NOT)||this.at(TT.MINUS)){ const op=this.advance().lexeme; return new AST.UnaryExpr(op, this.parseUnary(), 0,0); }
    return this.parsePostfix();
  }
  parsePostfix(){
    let e = this.parsePrimary();
    while(true){
      if(this.at(TT.LPAREN)){
        if(e instanceof AST.IdentifierExpr){
          this.advance(); const args=[];
          if(!this.at(TT.RPAREN)){ do{ args.push(this.parseExpr()); }while(this.match(TT.COMMA)); }
          this.expect(TT.RPAREN);
          e = new AST.CallExpr(e.name, args, e.line, e.col);
        } else { this.advance(); this.errors.push({type:'Sintáctico',desc:'Llamada inválida'}); }
      } else if(this.at(TT.DOT)){
        this.advance(); const prop = this.expect(TT.ID).lexeme;
        e = new AST.PropertyExpr(e, prop, 0, 0);
      } else if(this.at(TT.LBRACKET)){
        this.advance(); const idx = this.parseExpr(); this.expect(TT.RBRACKET);
        e = new AST.IndexExpr(e, idx, 0, 0);
      } else break;
    }
    return e;
  }
  parsePrimary(){
    const t = this.peek();
    if(this.match(TT.INT_LIT)) return new AST.LiteralExpr(t.value, 'int');
    if(this.match(TT.FLOAT_LIT)) return new AST.LiteralExpr(t.value, 'float');
    if(this.match(TT.STR)) return new AST.LiteralExpr(t.value, 'string');
    if(this.match(TT.TRUE)) return new AST.LiteralExpr(true, 'bool');
    if(this.match(TT.FALSE)) return new AST.LiteralExpr(false, 'bool');
    if(this.match(TT.ID)) return new AST.IdentifierExpr(t.lexeme, t.line, t.col);
    if(this.match(TT.LPAREN)){ const e=this.parseExpr(); this.expect(TT.RPAREN); return e; }
    if(this.at(TT.LBRACKET)){
      this.advance(); const elems=[];
      if(!this.at(TT.RBRACKET)){ do{ elems.push(this.parseExpr()); }while(this.match(TT.COMMA)); }
      this.expect(TT.RBRACKET);
      return new AST.ArrayExpr(elems, 0,0);
    }
    this.errors.push({type:'Sintáctico',desc:`Expresión inválida: ${t.type}`,line:t.line,col:t.col});
    this.advance();
    return new AST.LiteralExpr(null, 'null');
  }
}