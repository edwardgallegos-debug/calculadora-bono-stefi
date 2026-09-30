# Calculadora de Bono Stefi

App web instalable (PWA) para iPhone: calcula el **bono imponible que hay que ingresar** para que el sueldo líquido
de un trabajador crezca un monto dado (por ejemplo $150.000), **con o sin gratificación legal**.

Es el módulo «Bono de ajuste» del *Ajustador de Liquidaciones* de Reserva Las Torres, con el mismo motor de cálculo
(portado a JavaScript y verificado contra la versión Python en 300 casos aleatorios: 0 diferencias).

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

## Parámetros legales
Botón ⚙︎ (arriba a la derecha): UF, UTM, ingreso mínimo, topes, tasas y comisiones AFP. **UF y UTM deben actualizarse
cada mes.** Se guardan en el teléfono. Valores iniciales: septiembre 2026.

## Publicación (GitHub Pages)
Es un sitio estático (sin servidor): `index.html`, `style.css`, `motor.js`, `app.js`, `sw.js`, `manifest.webmanifest` e `icons/`.
Al cambiar archivos, subir el número `VERSION` de `sw.js` para que los teléfonos descarguen la versión nueva.

## Pruebas
`node tests/paridad.js` compara el motor JS con los resultados esperados de la app de escritorio (`tests/paridad.json`).

> Resultado referencial: confirmar siempre en el sistema de remuneraciones (Thomson).
