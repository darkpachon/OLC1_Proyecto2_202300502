# Definición Formal de la Gramática — AutoInfra

Este documento detalla la especificación léxica (tokens) y la gramática libre de contexto (CFG) expresada en notación para el lenguaje DSL de AutoInfra.

---

## 1. Especificación Léxica (Lexer)

### 1.1 Palabras Reservadas
```
SERVER      ::= 'server'
SERVICE     ::= 'service'
DATABASE    ::= 'database'
FUNCTION    ::= 'function'
TASK        ::= 'task'
MAIN        ::= 'main'
IF          ::= 'if'
ELSE        ::= 'else'
WHILE       ::= 'while'
FOR         ::= 'for'
BREAK       ::= 'break'
CONTINUE    ::= 'continue'
RETURN      ::= 'return'
RUN         ::= 'run'

INT_TYPE    ::= 'int'
FLOAT_TYPE  ::= 'float'
STRING_TYPE ::= 'string'
BOOL_TYPE   ::= 'bool'
VOID_TYPE   ::= 'void'
```

### 1.2 Literales e Identificadores
```
DIGIT       ::= [0-9]
LETTER      ::= [a-zA-Z_]

INTEGER_LIT ::= DIGIT+
FLOAT_LIT   ::= DIGIT+ '.' DIGIT+
STRING_LIT  ::= '"' ( [^"\\] | '\\' . )* '"'
BOOLEAN_LIT ::= 'true' | 'false'

ID          ::= LETTER ( LETTER | DIGIT )*
```

### 1.3 Operadores y Delimitadores
```
PLUS        ::= '+'
MINUS       ::= '-'
MULT        ::= '*'
DIV         ::= '/'
MOD         ::= '%'

ASSIGN      ::= '='
EQUAL       ::= '=='
NOT_EQUAL   ::= '!='
LESS        ::= '<'
GREATER     ::= '>'
LESS_EQ     ::= '<='
GREATER_EQ  ::= '>='

AND         ::= '&&'
OR          ::= '||'
NOT         ::= '!'

DOT         ::= '.'
COMMA       ::= ','
SEMICOLON   ::= ';'
LPAREN      ::= '('
RPAREN      ::= ')'
LBRACE      ::= '{'
RBRACE      ::= '}'
LBRACKET    ::= '['
RBRACKET    ::= ']'
```

### 1.4 Comentarios y Espacios
```
WS          ::= [ \t\r\n]+               (* Ignorado *)
LINE_COMMENT::= '//' [^\n]*              (* Ignorado *)
BLOCK_COMMENT::= '/*' ( [^*] | '*'+ [^*/] )* '*'+ '/' (* Ignorado *)
```

---

## 2. Gramática Sintáctica (Parser - EBNF)

### 2.1 Estructura Principal
```ebnf
Program ::= ( GlobalDecl )* MainBlock ;

GlobalDecl ::= ResourceDecl
             | FunctionDecl
             | TaskDecl
             | VarDeclStmt ;

MainBlock ::= "main" Block ;
```

### 2.2 Declaración de Recursos de Infraestructura
```ebnf
ResourceDecl ::= "server" ID "{" ResourceBody "}"
               | "service" ID "{" ResourceBody "}"
               | "database" ID "{" ResourceBody "}" ;

ResourceBody ::= ( PropertyStmt )* ;

PropertyStmt ::= ID "=" Expr ";" ;
```

### 2.3 Funciones y Tareas
```ebnf
FunctionDecl ::= "function" ID "(" ParamList? ")" ReturnType Block ;

TaskDecl ::= "task" ID Block ;

ParamList ::= Param ( "," Param )* ;

Param ::= Type ID ;

ReturnType ::= Type | "void" ;
```

### 2.4 Bloques y Sentencias
```ebnf
Block ::= "{" Statement* "}" ;

Statement ::= VarDeclStmt
            | AssignmentStmt
            | IfStmt
            | WhileStmt
            | ForStmt
            | ExecStmt
            | FunctionCallStmt
            | ReturnStmt
            | BreakStmt
            | ContinueStmt ;

VarDeclStmt    ::= Type ID ( "=" Expr )? ";" ;

AssignmentStmt ::= Target "=" Expr ";" ;

Target ::= ID
         | ResourcePropertyAccess
         | ArrayAccess ;

ResourcePropertyAccess ::= ID "." ID ;

ArrayAccess ::= ID "[" Expr "]" ;

IfStmt ::= "if" "(" Expr ")" Block ( "else" ( IfStmt | Block ) )? ;

WhileStmt ::= "while" "(" Expr ")" Block ;

ForStmt ::= "for" "(" ( VarDeclStmt | AssignmentStmt ) Expr ";" ForUpdate ")" Block ;

ForUpdate ::= ID "=" Expr | ID "++" | ID "--" ;

ExecStmt ::= "run" ID ";" ;

FunctionCallStmt ::= FunctionCall ";" ;

ReturnStmt ::= "return" Expr? ";" ;

BreakStmt ::= "break" ";" ;

ContinueStmt ::= "continue" ";" ;
```

### 2.5 Expresiones y Precedencia de Operadores
```ebnf
Expr ::= LogicalOr ;

LogicalOr ::= LogicalAnd ( "||" LogicalAnd )* ;

LogicalAnd ::= Equality ( "&&" Equality )* ;

Equality ::= Relational ( ( "==" | "!=" ) Relational )* ;

Relational ::= Additive ( ( "<" | ">" | "<=" | ">=" ) Additive )* ;

Additive ::= Multiplicative ( ( "+" | "-" ) Multiplicative )* ;

Multiplicative ::= Unary ( ( "*" | "/" | "%" ) Unary )* ;

Unary ::= ( "!" | "-" ) Unary
        | Primary ;

Primary ::= INTEGER_LIT
          | FLOAT_LIT
          | STRING_LIT
          | BOOLEAN_LIT
          | ArrayLiteral
          | FunctionCall
          | ResourcePropertyAccess
          | ArrayAccess
          | MethodCall
          | ID
          | "(" Expr ")" ;

ArrayLiteral ::= "[" ( Expr ( "," Expr )* )? "]" ;

FunctionCall ::= ID "(" ( Expr ( "," Expr )* )? ")" ;

MethodCall ::= ID "." ID "(" ( Expr ( "," Expr )* )? ")" ;

Type ::= "int"
       | "float"
       | "string"
       | "bool"
       | "server"
       | "service"
       | "database"
       | Type "[]" ;
```