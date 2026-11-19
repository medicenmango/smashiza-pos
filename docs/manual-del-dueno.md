# Manual del dueño

Así funciona Smashiza POS para el dueño de un local de comida. El cajero vende. Tú armas el menú, el inventario, el equipo y el look.

Cada negocio ve solo sus órdenes, su menú y su caja. El recibo lleva tu nombre y, al pie, “powered by Smashiza”.

Smashiza te crea el usuario y la contraseña. En la pantalla **ENTRAR** escribes eso. Si dejas de pagar, el negocio se suspende y el equipo ve una pantalla de acceso cerrado hasta que se reactive.

---

## Quién ve qué

| | Dueño | Cajero |
|---|---|---|
| Vender, órdenes, clientes, caja | Sí | Sí |
| Menú, inventario, análisis | Sí | No aparecen |
| Nombre, logo, IVA, cajeros | Sí | Los ve, no los cambia |

Arriba a la derecha el indicador dice **EN LÍNEA**. Si se va el internet, dice **SIN CONEXIÓN**. Puedes seguir vendiendo con lo último que cargó este aparato. Al volver la red, sube solo lo pendiente. Usa Chrome.

---

## Primer día

1. **NEGOCIO → LOOK DEL NEGOCIO.** Nombre que sale en el ticket, lema, teléfono, pie, logo, fuente y colores. **GUARDAR LOOK.** El encabezado del POS y la pestaña del navegador toman ese nombre.
2. **MENÚ.** Crea al menos un producto con su precio. Sin productos no hay qué vender.
3. **INVENTARIO**, si quieres que el stock baje solo. Primero el ingrediente, luego la receta del producto. Si no pones receta, la venta igual se cobra y el stock no se mueve.
4. **NEGOCIO → EQUIPO.** Usuario y contraseña del cajero (mínimo 6 caracteres). **CREAR CAJERO.**
5. **NEGOCIO → IVA.** La tasa de tu negocio. **0** significa sin IVA. No se pone 16% solo. **GUARDAR IVA.** El total que se guarda es lo que paga el cliente. Las órdenes ya cobradas se quedan con la tasa que tenían ese día.
6. **CAJA → ABRIR TURNO.** Escribe el efectivo con el que abres (puede ser 0).

En **CAJA** hay una lista **LISTO PARA EL TURNO**: menú, nombre del ticket y turno abierto. Es un aviso. No te impide vender.

---

## Un turno

1. Abres la caja con el fondo.
2. En **NUEVA ORDEN** armas el pedido y **MANDAR COMANDA**.
3. En **ÓRDENES** la pasas por los estados hasta **Entregada**.
4. Al cerrar, cuentas el cajón.

**Esperado en caja = fondo inicial + ventas en efectivo** de ese turno. Transferencia y tarjeta se anotan, pero no entran al cajón. La diferencia es contado menos esperado. $0 significa que el efectivo cuadra. **CERRAR TURNO** no borra órdenes.

Dueño y cajero pueden abrir y cerrar el turno.

---

## Cómo se cobra una orden

**NUEVA ORDEN** tiene el menú a la izquierda y el ticket a la derecha.

- Busca el producto o filtra por categoría. `+` y `−` cambian la cantidad.
- **CLIENTE** y **DIRECCIÓN** quedan para la entrega y para la lista de clientes. Si el nombre ya existió, te lo sugiere.
- **COMENTARIOS** es la nota de cocina (sin cebolla, extra salsa).
- **AJUSTE** es un monto en pesos: negativo es descuento (−20), positivo es un cargo (+30 de envío). No hay un botón de porcentaje.
- **ESTADO INICIAL** suele quedarse en Pendiente.
- Elige **Efectivo**, **Transferencia** o **Tarjeta**.
- En efectivo escribe con cuánto pagan, o usa $200, $500 o **EXACTO**. El ticket te dice el cambio o cuánto falta. Sin ese dato no deja guardar la orden en efectivo.
- En tarjeta aparece **COBRAR EN TERMINAL**: el total de la orden más 4.5%, solo para que sepas qué teclear en la terminal. Ese 4.5% no se suma a la orden ni a la caja.
- Si tu IVA es mayor a 0, el ticket muestra la tasa, el importe de IVA y el total. El total es subtotal + ajuste + IVA.
- **MANDAR COMANDA** guarda la orden y le pone el siguiente número.
- **COPIAR PARA CLIENTE** arma el recibo con tu logo, nombre y teléfono para pegarlo en WhatsApp.
- **LIMPIAR** vacía el ticket sin guardar.

La cola de abajo muestra las órdenes activas de hoy. Un clic abre la orden.

---

## Estados de la orden

Pendiente → Preparando → Lista → Entregada. **Cancelada** la saca de las ventas.

En **ÓRDENES** puedes cambiar el estado en el menú de la fila, o abrir la fila y editar productos, ajuste, pago y comentarios. El semáforo del tiempo es verde si lleva menos de 15 minutos, amarillo de 15 a 25, y rojo si pasa de 25. Entregada y Cancelada ya no lo muestran.

Filtros: **HOY**, **7 DÍAS**, **ESTE MES**, **TODO**, o un rango en el calendario. También filtras por estado o por cliente, número y producto. **RECARGAR** vuelve a traer los datos.

El stock baja cuando la orden pasa a **Entregada**, una vez, según la receta. Si la regresas a otro estado, cancelas o la borras, ese descuento se revierte. Un producto sin receta se vende igual y no toca inventario.

---

## Menú

Solo el dueño. Ahí cambias nombre, precio y orden (▲▼), y creas productos y categorías.

El precio del menú es el precio de la línea. El IVA, si lo tienes, se calcula al armar el ticket, no va escondido dentro de cada precio.

---

## Inventario

Solo el dueño. El stock no se edita a mano. Se mueve con:

- **entrada**, cuando compras
- **merma**, cuando se echa a perder
- **conteo**, cuando cuentas y ajustas
- **venta**, al marcar Entregada

Cada ingrediente tiene un nombre, una unidad (g, ml o pza), stock, mínimo e ideal. **POR COMPRAR** lista lo que está debajo del ideal.

La receta es plana: este producto usa estas cantidades de estos ingredientes. **GUARDAR RECETA** en cada producto. Un extra (tocino, aderezo) solo baja stock si está en la receta de ese producto.

---

## Dashboard, clientes y análisis

**DASHBOARD** resume el período que elijas: ventas, ticket promedio, lo más vendido, métodos de pago y las órdenes de hoy. Un clic en una orden reciente la abre.

**CLIENTES** agrupa por nombre. Muestra cuántas órdenes, cuánto ha gastado y la última compra. No cuenta las canceladas. Sirve para reconocer a quien ya pidió.

**ANÁLISIS** es del dueño. Cruza ventas con el costo de los ingredientes de la receta para ver qué producto deja más. Si un producto no tiene costo o receta, esa cuenta sale incompleta.

---

## Tu negocio

**NEGOCIO** es la ficha del local.

- **CAMBIAR DE NEGOCIO** solo aparece si tu usuario pertenece a más de un local. Al cambiar, la app recarga órdenes, menú e inventario de ese local. Si hay cambios sin subir, te avisa.
- **LOOK** es lo que ve el cliente en el ticket y lo que ves tú en la pantalla.
- **IVA** es el porcentaje de este negocio.
- **EQUIPO** lista a los miembros. Puedes crear cajeros y quitar a un cajero que ya no trabaja. No puedes quitarte a ti mismo como dueño, ni quitar al único dueño del local.
- **ZONA PELIGRO** borra este negocio si escribes el nombre exacto. Eso no existe en La Smashiza. Borrar un local de prueba no toca a los demás.

---

## Qué todavía no hace

- No cobra la tarjeta solo. La terminal la operas tú; el POS solo anota “Tarjeta” y te sugiere el monto con 4.5%.
- No imprime ticket térmico. El recibo se copia y se manda por WhatsApp.
- No hay pantalla de cocina aparte. La cola está en NUEVA ORDEN y en ÓRDENES.
- No factura CFDI.
- El descuento es un monto en pesos (AJUSTE), no un porcentaje.

Si algo no cuadra, escribe a cj.gz@hotmail.com con el nombre del negocio y una foto de la pantalla.
