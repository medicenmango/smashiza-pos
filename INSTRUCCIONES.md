# 🍔 La Smashiza Retro Burger — POS System

Sistema de punto de venta PWA para **La Smashiza Retro Burger**.

---

## 📂 ESTRUCTURA DE ARCHIVOS

```
smashiza-pos/
├── index.html          ← Aplicación principal
├── style.css           ← Estilos (tema arcade retro)
├── src/
│   ├── main.js         ← Arranque
│   ├── state.js        ← Estado global
│   ├── utils/  ui/     ← Formatos, toasts, reloj
│   ├── domain/         ← Reglas de negocio (menú, catálogo, órdenes, inventario)
│   ├── storage/        ← Persistencia (hoy: Excel)
│   └── features/       ← Cada pestaña de la app
├── demo-data.js        ← Datos del modo prueba
├── manifest.json       ← Configuración PWA
├── sw.js               ← Service Worker (offline)
└── icons/              ← Íconos PWA
```

> Si agregas o renombras un archivo en `src/`, agrégalo también a `ASSETS` en `sw.js` y sube `CACHE_NAME`.

---

## 🚀 CÓMO ABRIR

La app usa módulos de JavaScript, así que **ya no funciona con doble clic en `index.html`**: necesita servirse por `http://`.

### Desarrollo local

Requiere Node.js:

```bash
npm install      # solo la primera vez
npm run dev      # abre http://localhost:8080
npm run lint     # revisa errores en src/
```

> ⚠️ El Service Worker (modo offline) solo funciona con servidor local o HTTPS.

---

## 📱 INSTALAR COMO APP EN MAC (PWA)

Con el servidor local activo:

1. Abre Chrome → `http://localhost:8080`
2. Haz clic en los **tres puntos** (⋮) arriba a la derecha
3. Selecciona **"Instalar La Smashiza Retro Burger — POS"**
4. La app aparecerá en tu Dock y en Aplicaciones ✅

---

## 📊 PRIMER USO — CONFIGURAR EXCEL

### Si ya tienes un Excel:
1. Al abrir la app, verás la pantalla de **CARGAR EXCEL**
2. Haz clic en **"ELIGE TU EXCEL"** y selecciona tu archivo `.xlsx`
3. La app leerá todas las órdenes existentes

### Si no tienes Excel todavía:
1. Haz clic en **"crea uno nuevo aquí"**
2. Se descargará `LaSmashiza_Ordenes.xlsx` con las columnas correctas
3. Guárdalo donde quieras
4. Cárgalo con el botón **"ELIGE TU EXCEL"**

### Columnas del Excel:
| Columna | Descripción |
|---|---|
| Num_Orden | Número automático de orden |
| Fecha | YYYY-MM-DD |
| Hora | HH:MM:SS |
| Cliente | Nombre del cliente |
| Telefono | Teléfono |
| Productos | Productos separados por `|` |
| Cantidades | Cantidades separadas por `|` |
| Comentarios | Notas especiales |
| Metodo_Pago | Efectivo / Transferencia / Tarjeta |
| Total | Monto total |
| Estado | Pendiente / Preparando / Lista / Entregada / Cancelada |

---

## 🎮 CÓMO USAR EL POS

### Capturar una orden:
1. Ve a la pestaña **🍔 NUEVA ORDEN**
2. Escribe el nombre del cliente (opcional)
3. Selecciona productos del menú
4. Ajusta cantidades con `+` y `−`
5. Elige método de pago
6. Añade comentarios si hay personalización
7. Haz clic en **► GUARDAR ORDEN EN EXCEL**

### La orden se guarda automáticamente:
- ✅ Se agrega una nueva fila al Excel
- ✅ No sobrescribe registros anteriores
- ✅ El número de orden es automático y consecutivo
- ✅ Fecha y hora se capturan automáticamente

### Ver órdenes:
- Ve a **📋 ÓRDENES**
- Filtra por fecha o estado
- Haz clic en **⟳ RECARGAR EXCEL** para sincronizar

### Ver estadísticas:
- Ve a **📊 DASHBOARD**
- Muestra ventas del día, ticket promedio, top burgers, métodos de pago

---

## 💾 SOBRE EL GUARDADO

| Navegador | Comportamiento |
|---|---|
| Chrome (recomendado) | Guarda directamente en tu Excel original ✅ |
| Safari | Descarga el Excel actualizado (reemplaza el original) |
| Firefox | Descarga el Excel actualizado (reemplaza el original) |

> **Recomendación:** Usa Chrome para la mejor experiencia.  
> En Chrome, la app escribe directamente en tu archivo gracias al File System Access API.

---

## ⚠️ SOLUCIÓN DE PROBLEMAS

**"No se puede leer el archivo"**
→ Verifica que el archivo sea `.xlsx` (no `.xls` antiguo)

**"El archivo fue movido"**
→ Usa el botón **⇄** en la barra superior para volver a seleccionarlo

**Las órdenes no aparecen**
→ Haz clic en **⟳ RECARGAR EXCEL** en la pestaña Órdenes

**Chrome pide permiso para editar el archivo**
→ Haz clic en **"Permitir"** — es necesario para guardar en tu Excel

---

## 🎨 DISEÑO

Inspirado en la estética de arcades de los años 80:
- **Tipografía pixel:** Press Start 2P
- **Colores:** Rojo `#e63232` · Azul `#1a3bcc` · Beige `#f5e6c8`
- Efectos de scanlines y glow estilo CRT
- Animaciones de blink estilo retro
