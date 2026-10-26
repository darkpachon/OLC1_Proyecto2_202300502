# Manual Técnico — AutoInfra

**Proyecto 2 — Organización de Lenguajes y Compiladores 1**  
**Nombre:** Pablo Javier Álvarez Marroquín  
**Carné:** 202300502  
**Universidad de San Carlos de Guatemala — Facultad de Ingeniería**  

---

## 1. Arquitectura General del Sistema

AutoInfra sigue una arquitectura cliente-servidor estructurada en dos módulos independientes: un **Frontend Web** (desarrollado con React + Vite + Tailwind CSS) y un **Backend Intérprete** (Node.js + Express).

```
+-----------------------------------------------------------------------+
|                           FRONTEND (React)                            |
|  +------------------------+             +--------------------------+  |
|  |     Editor de Código   |             |   Panel de Reportes      |  |
|  |  (Monaco / Textarea)   |             |  (Consola, AST, Errores) |  |
|  +-----------+------------+             +------------^-------------+  |
+--------------|---------------------------------------|----------------+
               | POST /api/execute                     | JSON Response
               v                                       |
+------------------------------------------------------|----------------+
|                            BACKEND (Node.js)         |                |
|  +---------------------------------------------------|-------------+  |
|  |                     Controlador Express           |             |  |
|  +-----------------------------------+-----------------------------+  |
|                                      |                                |
|  +-----------------------------------v-----------------------------+  |
|  |                    1. Analizador Léxico (Lexer)                 |  |
|  +-----------------------------------+-----------------------------+  |
|                                      | Tokens                         |
|  +-----------------------------------v-----------------------------+  |
|  |                  2. Analizador Sintáctico (Parser)              |  |
|  +-----------------------------------+-----------------------------+  |
|                                      | AST (Abstract Syntax Tree)     |
|  +-----------------------------------v-----------------------------+  |
|  |               3. Evaluador / Intérprete (AST Walker)            |  |
|  |    +-------------------+  +------------------+  +------------+  |  |
|  |    | Entorno/Símbolos  |  |  Infraestructura |  |  Bitácora  |  |  |
|  |    +-------------------+  +------------------+  +------------+  |  |
|  +-----------------------------------+-----------------------------+  |
|                                      |                                |
|                                Output JSON                            |
+-----------------------------------------------------------------------+
```

---

## 2. Definición del Lenguaje Formal

### 2.1 Lexicografía (Tokens)

```
// Palabras Reservadas
SERVER      := "server"
SERVICE     := "service"
DATABASE    := "database"
FUNCTION    := "function"
TASK        := "task"
MAIN        := "main"
IF          := "if"
ELSE        := "else"
WHILE       := "while"
FOR         := "for"
BREAK       := "break"
CONTINUE    := "continue"
RETURN      := "return"
RUN         := "run"
INT_TYPE    := "int"
FLOAT_TYPE  := "float"
STRING_TYPE := "string"
BOOL_TYPE   := "bool"
VOID_TYPE   := "void"

// Literales
BOOLEAN_LIT := "true" | "false"
INTEGER_LIT := [0-9]+
FLOAT_LIT   := [0-9]+ "." [0-9]+
STRING_LIT  := "\"" [^"\\]* ( "\\" . [^"\\]* )* "\""
ID          := [a-zA-Z_][a-zA-Z0-9_]*

// Operadores y Símbolos
PLUS        := "+"
MINUS       := "-"
MULT        := "*"
DIV         := "/"
MOD         := "%"
ASSIGN      := "="
EQUAL       := "=="
NOT_EQUAL   := "!="
LESS        := "<"
GREATER     := ">"
LESS_EQ     := "<="
GREATER_EQ  := ">="
AND         := "&&"
OR          := "||"
NOT         := "!"
DOT         := "."
COMMA       := ","
SEMICOLON   := ";"
LPAREN      := "("
RPAREN      := ")"
LBRACE      := "{"
RBRACE      := "}"
LBRACKET    := "["
RBRACKET    := "]"
```

### 2.2 Gramática Context-Free (CFG) - Notación EBNF

```ebnf
Program ::= ( ResourceDecl | FunctionDecl | TaskDecl )* MainBlock ;

ResourceDecl ::= "server" ID "{" ResourceProps "}"
               | "service" ID "{" ResourceProps "}"
               | "database" ID "{" ResourceProps "}" ;

ResourceProps ::= ( Property ";" )* ;
Property      ::= ID "=" Expr ;

FunctionDecl ::= "function" ID "(" ParamList? ")" ReturnType Block ;
ParamList    ::= Param ( "," Param )* ;
Param        ::= Type ID ;
ReturnType   ::= Type | "void" ;

TaskDecl ::= "task" ID Block ;
MainBlock ::= "main" Block ;

Block ::= "{" Statement* "}" ;

Statement ::= VarDeclStmt
            | AssignmentStmt
            | ControlStmt
            | ExecStmt
            | FunctionCallStmt
            | ReturnStmt
            | BreakStmt
            | ContinueStmt ;

VarDeclStmt    ::= Type ID ( "=" Expr )? ";" ;
AssignmentStmt ::= ID "=" Expr ";" | ResourceAccess "=" Expr ";" ;
ControlStmt    ::= IfStmt | WhileStmt | ForStmt ;
ExecStmt       ::= "run" ID ";" ;
FunctionCallStmt ::= FunctionCall ";" ;
ReturnStmt     ::= "return" Expr? ";" ;
BreakStmt      ::= "break" ";" ;
ContinueStmt   ::= "continue" ";" ;

IfStmt    ::= "if" "(" Expr ")" Block ( "else" Block )? ;
WhileStmt ::= "while" "(" Expr ")" Block ;
ForStmt   ::= "for" "(" VarDeclStmt Expr ";" AssignmentExpr ")" Block ;

Expr ::= LogicalOr ;
LogicalOr ::= LogicalAnd ( "||" LogicalAnd )* ;
LogicalAnd ::= Equality ( "&&" Equality )* ;
Equality ::= Relational ( ( "==" | "!=" ) Relational )* ;
Relational ::= Additive ( ( "<" | ">" | "<=" | ">=" ) Additive )* ;
Additive ::= Multiplicative ( ( "+" | "-" ) Multiplicative )* ;
Multiplicative ::= Unary ( ( "*" | "/" | "%" ) Unary )* ;
Unary ::= ( "!" | "-" ) Unary | Primary ;

Primary ::= INTEGER_LIT | FLOAT_LIT | STRING_LIT | BOOLEAN_LIT
          | ID | ResourceAccess | FunctionCall | ArrayAccess | ArrayLiteral | "(" Expr ")" ;

ResourceAccess ::= ID "." ID ;
ArrayAccess    ::= ID "[" Expr "]" ;
ArrayLiteral   ::= "[" ( Expr ( "," Expr )* )? "]" ;
FunctionCall   ::= ID "(" ( Expr ( "," Expr )* )? ")" ;

Type ::= "int" | "float" | "string" | "bool" | ID | Type "[]" ;
```

---

## 3. Estructura y Componentes del Software

### 3.1 Módulo del Intérprete (Backend)

1. **`Lexer.js`**:
   - Escanea la cadena de entrada usando expresiones regulares.
   - Genera tokens con metadata completa (`type`, `value`, `line`, `column`).
   - Captura errores léxicos sin detener la ejecución.

2. **`Parser.js`**:
   - Algoritmo de descenso recursivo con *lookahead*.
   - Construye los nodos AST tipados (`ProgramNode`, `VarDeclNode`, `IfNode`, etc.).
   - Modo de recuperación ante errores sintácticos mediante delimitadores de pánico (`;`, `}`).

3. **`Environment.js` (Tabla de Símbolos)**:
   - Implementación de ámbitos jerárquicos con punteros a entornos padres.
   - Manejo de variables, constantes y ámbitos de funciones/tasks.

4. **`Evaluator.js`**:
   - Recorre el AST ejecutando la semántica del lenguaje.
   - Mantiene la tabla de recursos de infraestructura (`servers`, `services`, `databases`).
   - Implementa el motor de reglas para comandos como `start()`, `deploy()`, `scale()`, `connect()`.
   - Limita la ejecución a 100,000 ciclos para prevenir loops infinitos.

---

## 4. Tabla de Símbolos y Gestión de Ámbitos

El sistema maneja la tabla de símbolos mediante la clase `Environment`:

```typescript
class Environment {
    parent: Environment | null;
    variables: Map<string, SymbolRecord>;

    constructor(parent = null) {
        this.parent = parent;
        this.variables = new Map();
    }

    define(name: string, type: string, value: any): void;
    lookup(name: string): SymbolRecord | null;
    assign(name: string, value: any): boolean;
}
```

Estructura de un registro (`SymbolRecord`):
- **Identifier**: Nombre de la variable/función.
- **Category**: `variable`, `recurso`, `función`, `task`.
- **Type**: `int`, `float`, `string`, `bool`, `server`, `service`, `database`, etc.
- **Scope**: `global` o `local` (con sufijo de bloque).
- **Value**: Estado actual o valor en memoria.

---

## 5. Manejo de Errores

El motor agrupa los errores detectados en un vector unificado ordenado por línea y columna:

| Categoría | Código | Descripción / Causa |
|---|---|---|
| **Léxico** | `LEX-001` | Carácter ilegal no perteneciente al alfabeto del lenguaje. |
| **Sintáctico** | `SYN-001` | Token inesperado que viola la estructura gramatical. |
| **Semántico** | `SEM-000` | Múltiples bloques `main` declarados. |
| **Semántico** | `SEM-001` | Redeclaración de variable en un mismo ámbito. |
| **Semántico** | `SEM-004` | Incompatibilidad de tipos en asignación u operación. |
| **Infraestructura** | `INFRA-001` | Intento de realizar operaciones en recursos detenidos (`stopped`). |
| **Infraestructura** | `INFRA-004` | Inconsistencia en dependencias (`dependsOn`) al desplegar. |
| **Runtime** | `RUN-001` | División entre cero. |
| **Runtime** | `RUN-LIMIT` | Exceso de límite de instrucciones (máximo 100,000). |

---

## 6. Generación del AST para Visualización

El módulo AST convierte el árbol sintáctico a código en formato **DOT (Graphviz)**:

```javascript
function generateASTDot(node) {
    let output = "digraph AST {\n  node [shape=box, fontname=\"Helvetica\"];\n";
    let counter = 0;

    function traverse(n) {
        let id = `node${counter++}`;
        output += `  ${id} [label="${n.type}"];\n`;
        for (let child of n.children) {
            let childId = traverse(child);
            output += `  ${id} -> ${childId};\n`;
        }
        return id;
    }

    traverse(node);
    output += "}\n";
    return output;
}
```

El Frontend procesa este string usando **Viz.js** o `@hpcc-js/wasm` para renderizar un gráfico SVG dinámico e interactivo en la pestaña **AST**.