# Manual de Usuario — AutoInfra

**Proyecto 2 — Organización de Lenguajes y Compiladores 1**  
**Nombre:** Pablo Javier Alvarez Marroquin  
**Carné:** 202300502  
**Universidad de San Carlos de Guatemala — Facultad de Ingeniería**  

---

## 1. Introducción

AutoInfra es un intérprete para un lenguaje de dominio específico (DSL) orientado a la **automatización y simulación de infraestructura tecnológica**. Permite declarar servidores, servicios y bases de datos, definir funciones y tareas, y simular operaciones como iniciar, detener, instalar software, desplegar servicios y escalar réplicas — **todo de forma simulada**, sin conectarse a proveedores cloud reales.

Este manual describe cómo usar la interfaz web de AutoInfra: cómo crear, abrir, guardar y ejecutar archivos `.infra`, y cómo interpretar cada uno de los reportes generados.

---

## 2. Requisitos previos

Antes de arrancar la aplicación, asegúrate de tener:

- **Node.js** versión 18 o superior — [https://nodejs.org/](https://nodejs.org/)
- **npm** (viene incluido con Node.js)
- Un navegador moderno: Chrome, Edge o Firefox

Verifica con:

```bash
node --version
npm --version
```

---

## 3. Instalación y ejecución

La aplicación tiene **dos componentes**: un backend (Node.js + Express) y un frontend (React + Vite).

### 3.1 Instalar dependencias

Desde la raíz del proyecto:

**Terminal 1 — Backend:**

```bash
cd backend
npm install
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm install
```

### 3.2 Arrancar los servidores

**Terminal 1 (backend):**

```bash
cd backend
npm start
```

Salida esperada:

```
AutoInfra backend en http://localhost:8080
```

**Terminal 2 (frontend):**

```bash
cd frontend
npm run dev
```

Salida esperada:

```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 3.3 Abrir la aplicación

Abre tu navegador en:

👉 **http://localhost:5173**

[CAPTURA: pantalla principal de AutoInfra recién cargada — con el editor a la izquierda y el panel derecho vacío]

---

## 4. Descripción de la interfaz

La aplicación se divide en dos grandes columnas:

### 4.1 Columna izquierda — Editor

| Elemento | Descripción |
|---|---|
| **Barra de archivo** | Muestra el nombre del archivo actual (ej. `sin_titulo.infra`) |
| 🆕 **Nuevo** | Crea un archivo vacío (pide confirmación si hay cambios sin guardar) |
| 📂 **Abrir** | Abre un archivo `.infra` desde tu disco |
| 💾 **Guardar** | Descarga el contenido del editor con el nombre actual |
| 💾📝 **Guardar como** | Descarga el contenido con un nombre nuevo |
| ▶ **Ejecutar** | Envía el código al backend para análisis y ejecución |
| 🧹 **Limpiar** | Borra los resultados del panel derecho (sin borrar el código) |
| **Área de edición** | Donde escribes el código `.infra` |

[CAPTURA: barra de botones superior del editor con los 6 botones bien visibles]

### 4.2 Columna derecha — Reportes

Tiene **7 pestañas** que muestran los resultados de cada ejecución:

| Pestaña | Contenido |
|---|---|
| 📝 **Consola** | Salida de las llamadas a `print(...)` |
| 🖥️ **Infraestructura** | Tabla de recursos con su estado y propiedades |
| ❌ **Errores** | Errores léxicos, sintácticos, semánticos y de ejecución |
| 🔤 **Tokens** | Tabla completa de tokens reconocidos |
| 📋 **Símbolos** | Variables, recursos, funciones y tasks registrados |
| 📜 **Bitácora** | Historial de acciones ejecutadas |
| 🌳 **AST** | Árbol de sintaxis abstracta renderizado con Graphviz |

[CAPTURA: panel derecho con las 7 pestañas visibles]

---

## 5. Flujo básico de uso

### 5.1 Crear un archivo nuevo

1. Haz clic en 🆕 **Nuevo**.
2. Confirma la acción si te pregunta.
3. El editor se vacía y el nombre vuelve a `sin_titulo.infra`.

[CAPTURA: editor vacío después de presionar Nuevo]

### 5.2 Escribir tu primer programa

Escribe el siguiente código en el editor:

```infra
server web {
  cpu = 2;
  memory = 4;
  disk = 50;
  os = "ubuntu";
}

main {
  start(web);
  print("Servidor iniciado");
}
```

[CAPTURA: código escrito en el editor]

### 5.3 Ejecutar

Presiona ▶ **Ejecutar**. El panel derecho mostrará:

- Encabezado verde **✅ Ejecución exitosa**
- Pestaña **Consola**: `Servidor iniciado`

[CAPTURA: resultado de ejecución con "Servidor iniciado" en consola]

### 5.4 Guardar el archivo

1. Presiona 💾 **Guardar** (o 💾📝 **Guardar como**).
2. Escribe un nombre, por ejemplo `mi_primera_infra.infra`.
3. El archivo se descargará a tu carpeta de descargas.

[CAPTURA: diálogo del navegador pidiendo el nombre del archivo]

### 5.5 Abrir un archivo existente

1. Presiona 📂 **Abrir**.
2. Navega hasta tu archivo `.infra`.
3. Selecciónalo — el contenido se carga en el editor y el nombre actualiza.

[CAPTURA: explorador de archivos del navegador mostrando archivos .infra]

---

## 6. Ejemplo completo

Guarda como `ejemplo_completo.infra`:

```infra
server backend {
  cpu = 8;
  memory = 16;
  disk = 200;
  os = "ubuntu";
}

database postgres {
  engine = "postgresql";
  version = "16";
  port = 5432;
}

service api {
  port = 8080;
  replicas = 2;
  dependsOn = [postgres];
}

function retryStart(server s, int n) bool {
  if (n <= 0) { return false; }
  if (start(s)) { return true; }
  return retryStart(s, n - 1);
}

task production {
  start(postgres);
  retryStart(backend, 3);
  if (backend.status == "running" && postgres.status == "running") {
    install(backend, "docker");
    deploy(backend, api);
    for (int i = 2; i <= 5; i = i + 1) {
      scale(api, i);
    }
  }
}

main {
  run production;
  print("Infraestructura lista");
}
```

Presiona ▶ **Ejecutar** y verás:

**📝 Consola:**
```
Infraestructura lista
```

**🖥️ Infraestructura:**

| Nombre | Tipo | Estado | Detalles |
|---|---|---|---|
| backend | server | running | cpu:8 mem:16 disk:200 os:ubuntu |
| postgres | database | running | port:5432 |
| api | service | running | port:8080 replicas:5 host:backend |

**📜 Bitácora:**
```
[OK] Resource 'backend' registered
[OK] Resource 'postgres' registered
[OK] Resource 'api' registered
[OK] postgres started
[OK] backend started
[OK] docker installed on backend
[OK] api deployed on backend
[OK] api scaled from 2 to 3 replicas
[OK] api scaled from 3 to 4 replicas
[OK] api scaled from 4 to 5 replicas
```

[CAPTURA: pestaña Infraestructura con los 3 recursos]
[CAPTURA: pestaña Bitácora con todas las acciones]

**📋 Símbolos:**

| Identificador | Categoría | Tipo | Ámbito | Valor / Estado |
|---|---|---|---|---|
| backend | recurso | server | global | `<server backend (running)>` |
| postgres | recurso | database | global | `<database postgres (running)>` |
| api | recurso | service | global | `<service api (running)>` |
| production | task | task | global | `task()` |
| retryStart | función | bool | global | `f(server s, int n) → bool` |

[CAPTURA: pestaña Símbolos con todas las categorías]

**🌳 AST:** (árbol gráfico)

[CAPTURA: pestaña AST mostrando el árbol de Graphviz]

---

## 7. Interpretación de errores

AutoInfra reporta **cuatro tipos** de errores:

| Tipo | Cuándo ocurre | Ejemplo |
|---|---|---|
| **Léxico** | Caracteres no reconocidos, cadenas o comentarios sin cerrar | `@` no válido |
| **Sintáctico** | El parser no puede interpretar la estructura | Falta un `;` o `)` |
| **Semántico** | Uso incorrecto de variables, tipos o propiedades | `int x = "hola";` |
| **Ejecución / Infraestructura** | Fallo en tiempo de ejecución | División por cero, dependencia detenida |

### Ejemplo: error semántico

```infra
main {
  int x = "hola";
}
```

Resultado en la pestaña ❌ **Errores**:

| Tipo | Código | Descripción | Línea | Col |
|---|---|---|---|---|
| Semántico | SEM-004 | No se puede asignar string a variable int 'x' | 2 | 3 |

[CAPTURA: pestaña Errores mostrando el error SEM-004]

### Ejemplo: error de infraestructura

```infra
database db { engine="postgresql"; version="16"; port=5432; }
server backend { cpu=4; memory=8; disk=100; os="ubuntu"; }
service api { port=8080; replicas=2; dependsOn=[db]; }

main {
  start(backend);
  deploy(backend, api);
}
```

Resultado:

| Tipo | Código | Descripción | Línea | Col |
|---|---|---|---|---|
| Infraestructura | INFRA-004 | No se puede desplegar 'api'. Dependencia 'db' se encuentra en estado stopped | 6 | 3 |

[CAPTURA: pestaña Errores mostrando INFRA-004]

### Códigos de error

| Código | Significado |
|---|---|
| SEM-000 | `main` duplicado |
| SEM-001 | Variable ya declarada en el mismo ámbito |
| SEM-003 | Variable no declarada |
| SEM-004 | Tipo incompatible |
| SEM-005 | Función no definida / propiedad de solo lectura |
| SEM-006 | Propiedad inexistente |
| SEM-007 | `break`/`continue` fuera de ciclo, o `return` fuera de función |
| SEM-008 | Firma incorrecta en llamada |
| SEM-009 | Falta `return` en función tipada |
| SEM-010 | Task no definida |
| INFRA-001 | Instalar en servidor detenido |
| INFRA-002 | Desplegar en servidor detenido |
| INFRA-004 | Dependencia detenida al desplegar |
| INFRA-005 | `scale` con réplicas inválidas |
| RUN-001 | División por cero |
| RUN-LIMIT | Límite de 100,000 instrucciones excedido |

---

## 8. Referencia rápida del lenguaje

### 8.1 Recursos

```infra
server nombre { cpu=4; memory=8; disk=100; os="ubuntu"; }
service nombre { port=8080; replicas=2; dependsOn=[recurso]; }
database nombre { engine="postgresql"; version="16"; port=5432; }
```

### 8.2 Variables y tipos

```infra
int x = 5;
float y = 2.5;
string s = "hola";
bool b = true;
string[] arr = ["docker", "git"];
```

### 8.3 Estructuras de control

```infra
if (cond) { ... } else { ... }

while (cond) { ... }

for (int i = 0; i < 10; i = i + 1) { ... }

break;
continue;
```

### 8.4 Funciones y tasks

```infra
function nombre(server s, int n) bool {
  return true;
}

task nombre {
  start(s);
}
```

### 8.5 Funciones nativas

| Función | Efecto |
|---|---|
| `start(r)` | Cambia recurso de `stopped` a `running` |
| `stop(r)` | Cambia de `running` a `stopped` |
| `restart(r)` | Reinicia |
| `install(s, "pkg")` | Instala paquete en servidor |
| `uninstall(s, "pkg")` | Desinstala |
| `deploy(s, svc)` | Despliega servicio en servidor |
| `scale(svc, n)` | Cambia réplicas |
| `connect(a, b)` | Registra conexión lógica |
| `disconnect(a, b)` | Elimina conexión |
| `print(...)` | Imprime en consola |
| `length(arr)` | Tamaño de arreglo o string |
| `status(r)` | Retorna estado como string |

### 8.6 Punto de entrada

```infra
main {
  run mi_task;
  print("listo");
}
```

---

## 9. Preguntas frecuentes

**¿Por qué no se puede conectar a un servidor real?**  
AutoInfra es un intérprete **simulado**. Toda la infraestructura vive en memoria del backend; nada sale a la red.

**¿Qué pasa si mi programa tiene un ciclo infinito?**  
El intérprete tiene un límite de **100,000 instrucciones**. Al superarlo se detiene con error `RUN-LIMIT`.

**¿Puedo tener varias funciones `main`?**  
No. El parser reporta `SEM-000` si detecta más de una.

**¿Puedo modificar `status` directamente?**  
No. `status` es de **solo lectura**. Se cambia con `start()`, `stop()`, `deploy()`, etc.

**¿Se pierde el código al cerrar la ventana?**  
Sí. Debes presionar 💾 **Guardar** para descargar el `.infra`. El navegador no guarda automáticamente (por seguridad).

---

## 10. Créditos

- **Estudiante:** Pablo [Apellido] — 202300502
- **Curso:** Organización de Lenguajes y Compiladores 1
- **Catedrático:** [Nombre]
- **Auxiliar:** [Nombre]
- **Semestre:** Segundo semestre 2026