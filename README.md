# Stefi Calculator

App web instalable (PWA) para iPhone: calcula el **bono imponible que hay que ingresar** para que el sueldo líquido
de un trabajador crezca un monto dado (por ejemplo $150.000), **con o sin gratificación legal**.

Es el módulo «Bono de ajuste» del *Ajustador de Liquidaciones* de Reserva Las Torres, con el mismo motor de cálculo
(portado a JavaScript y verificado contra la versión Python en 300 casos aleatorios: 0 diferencias).

## Privacidad
La app es 100 % local: no tiene servidor, cuentas ni análisis. Los montos, la previsión y los parámetros se guardan solo
en el navegador del teléfono (`localStorage`) y nunca se envían a ninguna parte. El repositorio no contiene datos de trabajadores.

## Cómo se usa
1. Ingrese el **sueldo líquido actual** y **cuánto debe crecer**.
2. Marque o desmarque **«El bono lleva gratificación legal»**.
3. Indique la previsión (AFP, salud, contrato, zona extrema, jubilado) y toque **Calcular bono**.

El recuadro verde muestra el monto a ingresar; debajo, el detalle (gratificación, bruto, descuentos, impuesto, líquido nuevo).
Los datos opcionales (no imponibles y descuentos fijos actuales) se abren en «Datos opcionales».

## Instalar en el iPhone
1. Abrir la dirección de la app en **Safari**.
2. Tocar **Compartir → Añadir a pantalla de inicio**.
3. Se abre como una app, con ícono propio y sin conexión a internet.

## Actualización automática de UF y UTM
Una tarea de GitHub Actions (`.github/workflows/actualizar-parametros.yml`) corre todos los días, lee la UTM del mes y la UF del último día del mes
(mindicador.cl) y, si cambiaron, actualiza `params.json` y republica la app. La app lee `params.json` de su propio sitio al abrirse: en el pie
indica «automático». Sin conexión usa los últimos valores guardados. Si se edita UF o UTM a mano en ⚙︎, ese valor manda hasta que llegue un
período nuevo. La tarea no usa claves ni datos de personas; si la fuente falla o el cambio es > 3 %, la tarea falla y no toca el archivo.

## Parámetros legales
Botón ⚙︎ (arriba a la derecha): UF, UTM, ingreso mínimo, topes, tasas y comisiones AFP. **UF y UTM deben actualizarse
cada mes.** Se guardan en el teléfono. Valores iniciales: octubre 2026 (UTM $72.151; UF $41.247,63 del 31-oct, la de la liquidación).

## Publicación (GitHub Pages)
Es un sitio estático (sin servidor): `index.html`, `style.css`, `motor.js`, `app.js`, `sw.js`, `manifest.webmanifest` e `icons/`.
Al cambiar archivos, subir el número `VERSION` de `sw.js` para que los teléfonos descarguen la versión nueva.

## Pruebas
`node tests/paridad.js` compara el motor JS con los resultados esperados de la app de escritorio (`tests/paridad.json`).

> Resultado referencial: confirmar siempre en el sistema de remuneraciones (Thomson).
