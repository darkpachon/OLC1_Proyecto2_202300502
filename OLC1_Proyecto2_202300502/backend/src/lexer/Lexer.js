export const TT = {
  // Keywords
  INT:'INT', FLOAT:'FLOAT', STRING_T:'STRING_T', BOOL:'BOOL',
  SERVER:'SERVER', SERVICE:'SERVICE', DATABASE:'DATABASE',
  IF:'IF', ELSE:'ELSE', WHILE:'WHILE', FOR:'FOR',
  BREAK:'BREAK', CONTINUE:'CONTINUE', RETURN:'RETURN',
  FUNCTION:'FUNCTION', TASK:'TASK', MAIN:'MAIN', RUN:'RUN',
  TRUE:'TRUE', FALSE:'FALSE',
  // Literals
  ID:'ID', INT_LIT:'INT_LIT', FLOAT_LIT:'FLOAT_LIT', STR:'STR',
  // Operators
  PLUS:'PLUS', MINUS:'MINUS', STAR:'STAR', SLASH:'SLASH', PERCENT:'PERCENT',
  EQ:'EQ', NEQ:'NEQ', LT:'LT', GT:'GT', LTE:'LTE', GTE:'GTE',
  AND:'AND', OR:'OR', NOT:'NOT', ASSIGN:'ASSIGN',
  // Delimiters
  LBRACE:'LBRACE', RBRACE:'RBRACE', LPAREN:'LPAREN', RPAREN:'RPAREN',
  LBRACKET:'LBRACKET', RBRACKET:'RBRACKET',
  SEMI:'SEMI', COMMA:'COMMA', DOT:'DOT',
  EOF:'EOF'
};

const KEYWORDS = {
  int:TT.INT, float:TT.FLOAT, string:TT.STRING_T, bool:TT.BOOL,
  server:TT.SERVER, service:TT.SERVICE, database:TT.DATABASE,
  if:TT.IF, else:TT.ELSE, while:TT.WHILE, for:TT.FOR,
  break:TT.BREAK, continue:TT.CONTINUE, return:TT.RETURN,
  function:TT.FUNCTION, task:TT.TASK, main:TT.MAIN, run:TT.RUN,
  true:TT.TRUE, false:TT.FALSE
};

export class Token {
  constructor(type, lexeme, value, line, col) {
    this.type = type; this.lexeme = lexeme; this.value = value;
    this.line = line; this.col = col;
  }
}

export class Lexer {
  constructor(source) {
    this.src = source; this.pos = 0; this.line = 1; this.col = 1;
    this.tokens = []; this.errors = [];
  }

  peek(o=0){ return this.src[this.pos+o]; }
  advance(){ const c=this.src[this.pos++]; if(c==='\n'){this.line++;this.col=1;} else this.col++; return c; }
  add(type, lexeme, value=null){
    this.tokens.push(new Token(type, lexeme, value, this.line, this.col - lexeme.length));
  }
  error(msg){
    this.errors.push({ type:'Léxico', desc:msg, line:this.line, col:this.col });
  }

  tokenize(){
    while(this.pos < this.src.length){
      const c = this.peek();
      // whitespace
      if(/\s/.test(c)){ this.advance(); continue; }
      // comments
      if(c==='/' && this.peek(1)==='/'){ while(this.peek() && this.peek()!=='\n') this.advance(); continue; }
      if(c==='/' && this.peek(1)==='*'){
        this.advance(); this.advance();
        let closed=false;
        while(this.peek()){
          if(this.peek()==='*' && this.peek(1)==='/'){ this.advance(); this.advance(); closed=true; break; }
          this.advance();
        }
        if(!closed) this.error("Comentario multilínea sin cierre");
        continue;
      }
      // identifiers / keywords
      if(/[A-Za-z_]/.test(c)){
        let s=''; const l=this.line, col=this.col;
        while(this.peek() && /[A-Za-z0-9_]/.test(this.peek())) s+=this.advance();
        const type = KEYWORDS[s] || TT.ID;
        this.tokens.push(new Token(type, s, s, l, col));
        continue;
      }
      // numbers
      if(/[0-9]/.test(c)){
        let s=''; const l=this.line, col=this.col;
        while(this.peek() && /[0-9]/.test(this.peek())) s+=this.advance();
        let isFloat=false;
        if(this.peek()==='.' && /[0-9]/.test(this.peek(1))){
          isFloat=true; s+=this.advance();
          while(this.peek() && /[0-9]/.test(this.peek())) s+=this.advance();
        }
        this.tokens.push(new Token(isFloat?TT.FLOAT_LIT:TT.INT_LIT, s, isFloat?parseFloat(s):parseInt(s), l, col));
        continue;
      }
      // strings
      if(c==='"'){
        const l=this.line, col=this.col; this.advance();
        let v=''; let closed=false;
        while(this.peek()){
          const ch=this.advance();
          if(ch==='"'){ closed=true; break; }
          if(ch==='\\'){
            const n=this.advance();
            v += n==='n'?'\n' : n==='t'?'\t' : n==='"'?'"' : n==='\\'?'\\' : n;
          } else v+=ch;
        }
        if(!closed) this.error("Cadena sin cierre");
        this.tokens.push(new Token(TT.STR, v, v, l, col));
        continue;
      }
      // operators & delimiters
      const two = this.src.substr(this.pos, 2);
      const map2 = { '==':TT.EQ,'!=':TT.NEQ,'<=':TT.LTE,'>=':TT.GTE,'&&':TT.AND,'||':TT.OR };
      if(map2[two]){ this.advance();this.advance(); this.tokens.push(new Token(map2[two],two,null,this.line,this.col-2)); continue; }
      const map1 = {
        '+':TT.PLUS,'-':TT.MINUS,'*':TT.STAR,'/':TT.SLASH,'%':TT.PERCENT,
        '<':TT.LT,'>':TT.GT,'!':TT.NOT,'=':TT.ASSIGN,
        '{':TT.LBRACE,'}':TT.RBRACE,'(':TT.LPAREN,')':TT.RPAREN,
        '[':TT.LBRACKET,']':TT.RBRACKET,';':TT.SEMI,',':TT.COMMA,'.':TT.DOT
      };
      if(map1[c]){ this.advance(); this.tokens.push(new Token(map1[c],c,null,this.line,this.col-1)); continue; }
      // unknown
      this.error(`Carácter no reconocido '${c}'`);
      this.advance();
    }
    this.tokens.push(new Token(TT.EOF,'',null,this.line,this.col));
    return { tokens:this.tokens, errors:this.errors };
  }
}