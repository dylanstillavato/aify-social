# Revisión del proceso de contenido

Parte 3/3 del «repaso del proceso de contenido» (issue #102). Este documento recorre, paso a paso, cómo se crea hoy el contenido de un cliente en Aify, apunta lo que no tiene sentido o confunde y propone cómo debería quedar. **Solo es un documento:** no cambia nada en el código. Dylan decide después qué se hace y en qué orden.

Todo lo de abajo está comprobado en el código de la rama `main` (commit `3ed7df9`). Las rutas y números de línea son de ese commit. Cuando un punto ya lo arregla un PR abierto se indica como **«en curso»**.

---

## Cómo es hoy el recorrido

Así es un mes normal tal y como lo hace hoy un gestor (en octubre, preparando noviembre):

1. **Abre la ficha del cliente** (`/clientes/:id`). La ficha **se abre en el paso 4, «Publicar»**, no en «Ideas» (`src/utils/pasosCliente.js:19`, `TAB_POR_DEFECTO = 'edicion'`). Arriba ve «Proceso de octubre» y cinco pasos con un contador debajo de cada uno.
2. **Ideas** → pantalla «Preparar el mes», que ya está en **noviembre**. Pide cuántas piezas quiere, revisa las fechas y escribe o dicta de qué hablar. Pulsa «Generar 25 ideas para noviembre de 2026».
3. Al acabar, la app **le lleva sola al paso Guiones** con `?mes=2026-11` en la URL. Ahí, arriba, aparecen las **25 ideas** («Ideas de noviembre · 25»): las revisa, rehace las que no le convencen y pulsa «Guionizar».
4. Los guiones aparecen **en esa misma pantalla, más abajo**. Saca los planos, los envía al cliente para que los apruebe, y cuando están aprobados fija el **día de grabación y el de edición** en la tarjeta «Producción»… que también está dentro del paso Guiones.
5. **Grabación** → enseña la hoja de rodaje, pero **la de octubre** (el mes en curso), no la de noviembre, que es la que va a grabar.
6. **Publicar** → calendario del mes, que también se abre en **octubre**. Los guiones aprobados «sin fecha» se ponen en el calendario desde «Nuevo post» o desde cada guion (en el paso Guiones, con «Añadir al calendario»).
7. **Seguimiento** → métricas de Instagram de los últimos 30 días y las publicaciones del mes en curso.

Además, casi todo esto se puede hacer **también desde el menú lateral**, en páginas sueltas: Contenido, Calendario, Guiones del mes, Lluvia de ideas, Ideas y guiones, Programar publicaciones y Métricas Instagram.

---

## Paso 1: Ideas

### Para qué sirve
Preparar el mes del cliente: elegir cuántas piezas se quieren de cada tipo, revisar las fechas importantes, contar de qué se quiere hablar y, con eso, generar las ideas del mes con la IA (`src/components/PrepararMes.jsx`).

### Qué ve el gestor
- Título «Preparar el mes» y debajo «Qué piezas quieres, qué fechas importan y de qué hablar. Con eso salen las ideas del mes.» A la derecha, flechas ‹ › y el mes. **Por defecto es el mes siguiente** (en octubre sale «noviembre de 2026», `PrepararMes.jsx:37-38`).
- Tarjeta «Piezas del mes · N» y debajo «Cuántas quieres de cada tipo.», con un contador − / + por tipo de pieza.
- Tarjeta «Fechas importantes»: las fechas del perfil del cliente para ese mes, que se pueden borrar (X roja) o añadir («Añadir fecha»).
- Tarjeta «¿De qué quieres hablar este mes?» con un cuadro de texto y el botón «Dictar» / «Parar».
- Botón grande «Generar N ideas para noviembre de 2026» (o «Elige cuántas piezas quieres» si no hay ninguna), y al lado «Plan guardado» / «Guardando...».
- Si ya hay ideas de ese mes, sale un aviso naranja: «Ya hay N ideas de noviembre de 2026» con «Añadir las nuevas», «Reemplazar las que no tienen guion» y «Cancelar» (`PrepararMes.jsx:219-228`).
- Encima de todo, si hay tareas enlazadas a este paso, la tarjeta «Tareas de este paso · N» con «Ir a Tareas» (`src/components/TareasDelPaso.jsx`; sale en todos los pasos).

### Qué no se entiende
- **El paso Ideas no enseña las ideas.** Esta pantalla solo es el formulario del plan. Las ideas generadas no se ven aquí: solo aparecen en el paso Guiones (ver Paso 2). El gestor genera 25 ideas y, si vuelve a «Ideas», no las encuentra. Solo sabe que existen por el aviso «Ya hay 25 ideas» cuando intenta generar otra vez.
  - *Comprobación del punto ya detectado («las ideas salen dos veces: en Ideas y arriba de Guiones»):* en `main` **eso ya no es así**. `PrepararMes` no lista ideas. Hoy las ideas salen **una sola vez, pero en el paso equivocado** (Guiones). Lo que sí está duplicado es otra cosa: dentro del paso Guiones, cada pieza guionizada sale **dos veces**, como idea «Con guion» arriba y como guion abajo (ver Paso 2).
- **El contador del paso no cuenta ideas.** Debajo de «Ideas» pone «Sin ideas» o «N ideas», pero ese número sale de los **posts del calendario del mes en curso** (`src/components/ProcesoCliente.jsx:39-40`), no de la tabla de ideas. Después de generar 25 ideas para noviembre, el paso sigue diciendo «Sin ideas». En cambio, un post creado a mano en el calendario («Nuevo post») cuenta como «1 idea».
  - El PR #114 (issue #100, **en curso**) cambia el contador por la descripción fija «Lluvia de ideas» y deja solo el check verde. Pero el check sigue saliendo de los posts (`ideas = total > 0`), así que el problema de fondo sigue ahí. Además, «Lluvia de ideas» es el nombre de **otra herramienta del menú** (`/lluvia-de-ideas`), no de esta pantalla, que se llama «Preparar el mes».
- **El mes no es el mismo que en el resto de la ficha.** Ideas abre el mes siguiente, mientras que Guiones, Grabación, Publicar y el encabezado abren el mes en curso. El mes que se elige aquí con las flechas no se guarda en la URL y se olvida al cambiar de paso: al volver a Ideas siempre sale otra vez «el mes que viene».
- «Reemplazar las que no tienen guion» borra ideas sin pedir confirmación (`PrepararMes.jsx:120-127`).

### Saltos a otras pantallas
- Al terminar de generar, salta solo al paso Guiones y pone `?mes=AAAA-MM` en la URL (`src/pages/ClienteDetalle.jsx:1778`). Es el único sitio de la ficha que escribe `?mes`.
- «Ir a Tareas» (tarjeta de tareas) → `/todo`.

### Propuesta
- Que el paso Ideas sea **el sitio de las ideas**: arriba el plan del mes (lo de ahora, plegable una vez generado) y debajo la lista «Ideas de noviembre» que hoy está en Guiones, con rehacer, cambiar formato, borrar y elegir. Su botón final sería «Guionizar las elegidas», que lleva a Guiones.
- Que el check de Ideas salga de la tabla `ideas` del mes que se ve (`getIdeas(cliente.id, mes)`), no de los posts. Y que la descripción fija sea «Preparar el mes», no «Lluvia de ideas».
- Que el mes elegido aquí se guarde en `?mes` (como hace Guiones) y sea el mes de toda la ficha (ver «Otros problemas transversales»).
- Pedir confirmación en «Reemplazar las que no tienen guion».

---

## Paso 2: Guiones

### Para qué sirve
Convertir las ideas del mes en guiones (vídeo o carrusel), sacar los planos, enviarlos al cliente para que los apruebe y, con los aprobados, fijar los días de grabación y edición. Es `src/pages/GuionesMes.jsx` incrustado en la ficha (`ClienteDetalle.jsx:1781-1784`).

### Qué ve el gestor
De arriba abajo:
1. Tarjeta «Tareas de este paso · N», si hay alguna.
2. Selector de mes ‹ octubre 2026 ›. Abre el mes de `?mes` si lo hay y, si no, **el mes en curso** (`GuionesMes.jsx:464-465`).
3. **Bloque de ideas** (`src/components/IdeasGuardadasMes.jsx`, montado en `GuionesMes.jsx:625`): «Ideas de noviembre · 25», «Revísalas, rehaz las que no te convenzan y guioniza una a una o todas a la vez.», y los botones «Escribir idea», «Elegir todas» y «Guionizar (N)». Las ideas van agrupadas por tipo de pieza («REEL · 5»…). En cada idea hay: casilla, título, chip «Vídeo ⇄» / «Carrusel ⇄», etiqueta «Manual» o «Con guion», botón «Guionizar →» o «Regenerar guion», **una fecha suelta** («24 oct») y la papelera. Las que no tienen guion enseñan además su concepto, el campo «¿Qué cambiarías?» y «Regenerar» / «Rehacer con esto» / «Deshacer». Si ese mes no tiene ideas, el bloque no sale.
4. **Resumen**: cinco cifras, «N vídeos este mes», «N carruseles», «N con guion», «N aprobados» y «N con cambios». Debajo, los botones «Generar los N guiones que faltan», «Sacar planos de N guiones», «Escribir guion», «Enviar para aprobar», «Exportar PDF» y «Hoja de rodaje».
5. **Tarjeta «Producción»** (`src/components/PlanProduccion.jsx`, solo si hay guiones aprobados): «Hay N vídeos aprobados sin planificar. Elige los días y se añaden al calendario del cliente y a la columna "Por grabar" del tablero.», con las fechas «Día de grabación» y «Día de edición» y el botón «Planificar los N vídeos». Cuando ya están planificados: «N vídeos aprobados están en el tablero · grabación el … · edición el …» y «Abrir tablero ›».
6. **Lista de guiones**: cada fila lleva la fecha («vie 14» o «Sin fecha»), el título, el formato, el estado («Sin guion», «Pendiente de aprobar», «Aprobado», «Cambios pedidos»), «Aprobar» / «Deshacer» y la papelera. Al abrir una fila se ven el guion y los planos, con «Guardar planos», «Regenerar guion», «Pasar a carrusel», «Generar similares», versiones, etc. En los guiones «Sin fecha» aparece el bloque «AÑADIR AL CALENDARIO»: fecha (por defecto, mañana), red y «Añadir al calendario». Ese bloque solo funciona **después del día de grabación**. Si no, enseña «Fija el día de grabación primero: los guiones se añaden al calendario después de grabar.» (`GuionesMes.jsx:504-508`).

### Qué no se entiende
- **Las ideas viven aquí y no en Ideas.** Lo primero que ve el gestor en «Guiones» es una lista de ideas. Y cada pieza ya guionizada sale **dos veces** en la misma pantalla: arriba como idea «Con guion» (atenuada, con «Regenerar guion») y abajo como guion.
- **«Regenerar guion» hace cosas distintas según dónde se pulse.** En la fila de la idea abre el modal «Generar guiones», con elección de mes y red (`IdeasGuardadasMes.jsx`, `onGenerar([g], …, true)`). En la fila del guion regenera directamente, sin modal. Además, «Regenerar» a secas (en la idea sin guion) rehace **la idea**, no el guion.
- **Cuatro nombres para la misma acción:** «Guionizar», «Generar los N guiones que faltan», «Generar guion con planos» y, en Lluvia de ideas, «Generar guiones» / «Desarrollar» (mismo componente, `IdeasGuardadasMes.jsx:198` y `:252`).
- **Cifras sin contexto:**
  - «Ideas de noviembre · 25» cuenta también las ideas que ya tienen guion.
  - «vídeos este mes» dice «este mes» aunque se esté viendo otro mes (`GuionesMes.jsx:634`).
  - La fecha suelta junto a cada idea es la fecha en que se guardó, sin etiqueta (`IdeasGuardadasMes.jsx:255`). La quita el PR #115 (issue #101, **en curso**), que además añade el título «Guiones de <mes>» encima de la lista y hace que, tras guionizar, «Ver los guiones» baje hasta ellos.
  - En la lista, «Sin fecha» quiere decir «aún no está en el calendario», pero el guion sí tiene una fecha interna (el día 1, como ancla del mes).
- **El contador del paso** es «3/8 · 1 aprobado» (`ProcesoCliente.jsx:42-51`): no dice qué es 3 ni qué es 8. Además solo cuenta vídeos, mientras que la pantalla cuenta vídeos y carruseles. El PR #114 (**en curso**) lo cambia por «Escribir y aprobar» y el check.
- **Las flechas de mes borran `?mes`** (`GuionesMes.jsx:519-523`). Al cambiar de mes con las flechas desaparece `?mes`. Si luego se pasa a otro paso y se vuelve, Guiones abre **el mes en curso** y no el que se estaba mirando (el componente se desmonta al cambiar de pestaña). Con el PR #114, que lee `?mes` para el encabezado, el encabezado volverá a decir «Contenido de octubre» mientras la lista enseña diciembre. Lo mismo pasa cuando el modal de guionizar lleva a otro mes (`onHecho` cambia el mes interno, pero no la URL).
- **La planificación de la grabación está en Guiones, no en Grabación.** El «Día de grabación» y el «Día de edición» se fijan en la tarjeta «Producción» de este paso. Y el bloque «AÑADIR AL CALENDARIO» dice «Fija el día de grabación primero» sin decir dónde. Además, esa tarjeta solo aparece cuando ya hay guiones aprobados.
- **Hay dos formas de crear la tarjeta de producción.** Se crea al guionizar (`crearTareaPorGrabar`, en `GenerarGuionesModal`) y también al «Planificar» en Producción. El texto «N vídeos aprobados sin planificar» no explica que muchos ya tienen tarjeta.
- «Hoja de rodaje» abre aquí un panel lateral **igual** que el paso Grabación.

### Saltos a otras pantallas
- Lista vacía: «Preparar el mes» → paso Ideas. «Ir al calendario» → paso Publicar, subvista Calendario (vía el alias `calendario`, `GuionesMes.jsx:566-569`).
- «Abrir tablero ›» (Producción) → `/todo`.
- «Ir a Tareas» → `/todo`.
- Desde Tareas (`src/pages/ToDo.jsx:554-565`), una tarea con guion abre la ficha en Guiones con `?mes=…&guion=…`, incluso las tareas de producción del paso «grabacion».

### Propuesta
- Sacar el bloque de ideas a Paso 1. En Guiones dejar solo **los guiones** del mes, con un enlace corto «← Volver a las ideas (25, 8 sin guionizar)».
- Un solo verbo, «Guionizar», para pasar de idea a guion. «Regenerar guion» solo dentro del guion. Y que «Regenerar» de la idea pase a llamarse «Rehacer idea».
- Etiquetar las cifras: «25 ideas · 8 sin guion»; «vídeos en noviembre» en vez de «este mes»; «Sin fecha» → «Sin publicar en el calendario».
- Que las flechas de mes **escriban** `?mes` en vez de borrarlo (`setSearchParams({ mes: 'AAAA-MM' }, { replace: true })`), igual que `onHecho` del modal.
- Mover la tarjeta «Producción» (día de grabación y edición) al paso Grabación (ver Paso 3) y quitar de aquí el botón «Hoja de rodaje», o dejarlo como enlace al paso Grabación.
- El mensaje «Fija el día de grabación primero» debería llevar un botón «Ir a Grabación».

---

## Paso 3: Grabación

### Para qué sirve
Preparar y llevar el día de rodaje: ver todos los planos de los vídeos (y las fotos de los carruseles) agrupados para grabarlos seguidos, e ir marcando lo que ya se ha grabado (`PasoGrabacion` en `src/components/PasosCliente.jsx:228-267` + `src/components/HojaRodaje.jsx` en modo `inline`).

### Qué ve el gestor
- Tarjeta «Tareas de este paso · N»: una por pieza guionizada (las crea `crearTareaPorGrabar` con `paso: 'grabacion'`), cada una con un editor de fechas «Grabar / Editar / Publicar».
- Texto: «Los planos de los vídeos de **octubre** agrupados por tipo, para grabarlos seguidos en un día, y aparte las fotos de cada carrusel. Márcalos según los hagas.»
- Si ningún vídeo tiene planos: «Ningún vídeo de octubre tiene planos todavía», «Escribe los guiones y saca sus planos para preparar el rodaje.» y el botón «Ir a guiones».
- Si los tiene, la hoja de rodaje: «Hoja de rodaje · Cliente · Octubre 2026», «Exportar PDF», «Compartir enlace», «N planos de N vídeos · N slides de N carruseles», una barra de progreso con «N de M hechos» y «Reiniciar», el interruptor «Solo guiones aprobados», el cuadro «Material y notas del día» y los bloques «Vídeos» (por tipo de plano, con «N de M») y «Carruseles». Cada plano lleva una **casilla cuadrada sin texto** a la izquierda (el texto solo aparece al pasar el ratón: «Marcar como grabado»), su título, su fecha, sus segundos, «Se ve» y «Se dice».
- Al final, una tarjeta discontinua: «Planificación del día de grabación. La fecha, la hora y el lugar del día de rodaje, con aviso al cliente, llegarán en una fase posterior.» (`PasosCliente.jsx:263`).

### Qué no se entiende
- **Enseña el mes equivocado.** `PasoGrabacion` usa siempre el mes en curso (`PasosCliente.jsx:229-232`). El propio código de Guiones dice que «se suele grabar justo antes del mes de publicación» (`GuionesMes.jsx:497-498`): a finales de octubre se graba lo de noviembre, pero este paso enseña octubre y no tiene flechas de mes. Para ver la hoja de noviembre hay que ir a Guiones › noviembre › «Hoja de rodaje».
- **Cómo marcar lo grabado.** La casilla no tiene texto visible y no se explica que también se puede marcar desde el enlace compartido. La barra dice «hechos» y el paso dice «planos grabados»: son la misma cosa con dos nombres.
- **Dónde se guarda lo marcado.** Cada plano marcado se guarda **solo en este navegador** (localStorage, `HojaRodaje.jsx:9-17`). Solo cuando se marcan **todos** los planos de un vídeo se guarda en la base de datos (`grabadoEn`). Otro gestor, otro ordenador o el móvil ven el progreso a medias distinto.
- **Dos números distintos para el mismo progreso.** El contador del paso («3/12 planos grabados», `ProcesoCliente.jsx:20-31, 53-56`) cuenta todos los planos sin el filtro «Solo guiones aprobados» y sin las fotos de los carruseles. La barra de la hoja sí aplica el filtro y sí suma las slides. Por eso el paso y la hoja no coinciden.
- **De dónde salen los planos.** Salen del botón «Sacar planos» de cada guion en el paso Guiones. La pantalla no lo dice cuando hay algún guion con planos pero otros no (en ese caso esos otros simplemente no aparecen). Y con «Solo guiones aprobados», que **se activa solo** en cuanto hay un aprobado, los no aprobados desaparecen de la hoja sin aviso.
- **«Reiniciar»** borra todas las marcas sin confirmar y además desmarca en la base de datos los vídeos grabados (`HojaRodaje.jsx`, función `reiniciar`).
- **La tarjeta «Planificación del día de grabación… llegará en una fase posterior» ya no es verdad.** El día de grabación ya se fija en Guiones › Producción y también desde las tareas de este mismo paso (editor «Grabar / Editar / Publicar»). Hay **tres** sitios para la fecha de grabación y uno de ellos dice que todavía no existe.
- **Marcar un vídeo como grabado no mueve su tarjeta del tablero** de «Por grabar» a «Por editar» (`src/services/tareasAutomaticas.js` solo crea en «Por grabar» y mueve a «Por publicar»). Así, el estado «grabado» existe en tres sitios que no se hablan: casillas, `grabadoEn` y columna del tablero.
- La **edición** no tiene paso propio: su fecha se pone en Guiones (Producción) o en las tareas de Grabación, y el id interno del paso Publicar es `edicion`.

### Saltos a otras pantallas
- «Ir a guiones» → paso Guiones (en el mes en curso, o en `?mes` si sigue en la URL).
- «Compartir enlace» → crea `/rodaje/<token>` («Abrir» lo abre en otra pestaña).
- «Ir a Tareas» → `/todo`.

### Propuesta
- Que Grabación use **el mes que se está viendo** (`?mes`), con las mismas flechas que Guiones.
- Traer aquí la tarjeta «Producción» de Guiones: «Día de grabación», «Día de edición» y «Planificar». Quitar la tarjeta «llegará en una fase posterior».
- Dar texto visible a la casilla («Grabado») y usar una sola palabra en todas partes («grabados», no «hechos»).
- Guardar las marcas de cada plano en la base de datos, no en el navegador (el post ya tiene `grabadoEn` por vídeo; faltaría guardarlo por plano). Si no se hace, decirlo claro en pantalla: «Lo que marques se guarda en este dispositivo hasta que el vídeo esté completo».
- Que el contador o check del paso salga de la misma cuenta que la barra de la hoja (misma función, mismo filtro).
- Al marcar un vídeo como grabado, mover su tarjeta a «Por editar». Y pedir confirmación en «Reiniciar».

---

## Paso 4: Publicar (id `edicion`)

### Para qué sirve
Poner las piezas en el calendario con día y hora y publicarlas (o programarlas) en Instagram desde Aify. Es `src/components/CalendarioPublicacion.jsx` con `conHuecos`, más la subvista «Contenido» (`TabContenido`, `ClienteDetalle.jsx:1039-1176`).

### Qué ve el gestor
- Interruptor pequeño «Calendario | Contenido» (`SubvistaEdicion`, `ClienteDetalle.jsx:1456-1478`).
- **Calendario**: ‹ mes › (o semana), «Mes | Semana», «Actualizar», «Huecos» (ojo), «Nuevo post» y chips con el recuento («2 programado», «1 publicado»). En la rejilla aparecen los posts, las fechas importantes, los «huecos sugeridos» y el + de cada día. Aviso: «Conecta el Instagram de este cliente…».
  - «Nuevo post» abre un formulario (título, fecha, hora, formato, «Crear») y debajo la lista «GUIONES APROBADOS SIN FECHA · N». Si se elige un guion de esa lista, el botón pasa a «Poner en el calendario».
  - Al pulsar un post se abre a la derecha su ficha: estado «Sin publicar / Programado / Publicado» para marcarlo a mano, publicar en Instagram y borrar.
- **Contenido**: lista de **todos los guiones del cliente de todos los meses**, con título, duración, la fecha en bruto (p. ej. «· 2026-11-01») y el botón de PDF. Si no hay ninguno: «Todavía no hay guiones generados. Desarrolla ideas del calendario para verlos aquí.»
- Debajo de todo, «Tareas de este paso · N».

### Qué no se entiende
- **El calendario tiene su propio mes.** Siempre abre el mes en curso (`CalendarioPublicacion.jsx:272`, `useState(() => new Date())`) y no lee `?mes`. Viniendo de Guiones › noviembre, «Publicar» enseña octubre.
- **Dos formas de poner un guion en el calendario, con reglas distintas:**
  - En Guiones, «Añadir al calendario» solo deja hacerlo **después del día de grabación**.
  - Aquí, «Nuevo post» › «Guiones aprobados sin fecha» lo deja hacer **siempre**.
  - Además, en Guiones la fecha propuesta es «mañana» (`GuionesMes.jsx`, `fechaPub`), aunque se esté viendo otro mes.
- **El botón «Nuevo post» hace dos cosas distintas**: crear un post vacío nuevo o dar fecha a un guion que ya existe.
- **La subvista «Contenido» se llama igual que la página del menú «Contenido»** y no tiene nada que ver: aquí es una lista de guiones del cliente (de todos los meses) que repite lo que ya está en Guiones. Su texto vacío («Desarrolla ideas del calendario») describe un flujo antiguo, y la fecha que enseña es la fecha interna en formato `AAAA-MM-DD`: en los guiones sin fecha sale el día 1 del mes, que no es una fecha de publicación.
- **El contador del paso «0/25 publicados»** (`ProcesoCliente.jsx:58-61`) cuenta **todos** los posts del mes en curso, incluidos los guiones que aún no están en el calendario y los posts de redes que Aify no publica. El check «hecho» solo se pone verde si todo está publicado, así que con un post de TikTok sin marcar a mano nunca se completa. El PR #114 (**en curso**) cambia el texto por «Calendario», pero deja la misma regla para el check.
- **«Publicado» se marca en tres sitios:** la ficha del post en este calendario («Sin publicar / Programado / Publicado»), la página Contenido («Marcar como publicado», `src/pages/Contenido.jsx:330`) y la publicación real desde Aify.
- En el calendario, las fechas marcadas (p. ej. «Día de grabación») salen con el texto **«Marcada en Investigación: …»** (`CalendarioPublicacion.jsx:184`). «Investigación» ya no es un paso: `normalizarProceso` lo descarta (`pasosCliente.js:46-47`) y `PasoInvestigacion` no se puede abrir desde ningún sitio.
- **El nombre interno no coincide con el visible**: el paso se llama «Publicar», pero su id es `edicion` y en el código aparece como «Edición y publicación». Para quien lo implemente es una trampa.
- **La ficha se abre aquí** (paso 4) por defecto, aunque el comentario del código dice «o Ideas» (`ClienteDetalle.jsx:1492-1497`).

### Saltos a otras pantallas
- Desde Calendario general (`src/pages/CalendarioGeneral.jsx:121`), al pulsar un post se abre la ficha del cliente en Publicar › Calendario, pero **en el mes en curso**, no en el mes del post.
- «Conectar Instagram» → OAuth de Instagram y vuelta a la ficha con `?instagram=…`, que abre Seguimiento (`ClienteDetalle.jsx:1495-1496`).
- Enlace «Ver en Instagram» del post publicado → Instagram.
- «Ir a Tareas» → `/todo`.

### Propuesta
- Que el calendario reciba el mes de la ficha (`?mes`) como mes inicial y que sus flechas lo actualicen.
- Una sola regla para «poner en el calendario» y un solo sitio principal. Propuesta: aquí, con un bloque fijo «Listos para publicar (N)» encima del calendario, en vez de esconderlo dentro de «Nuevo post». «Nuevo post» quedaría solo para crear posts sueltos. Decidir si se mantiene la regla «después del día de grabación» y aplicarla igual en los dos sitios.
- Quitar la subvista «Contenido» (repite Guiones). Si se quiere conservar, llamarla «Archivo de guiones» y enseñar las fechas en formato legible.
- Que el check «hecho» cuente solo los posts **en el calendario** (`enCalendario !== false`) y de redes que se publican desde Aify, o que se pueda marcar a mano.
- Cambiar «Marcada en Investigación» por «Fecha marcada» y borrar el código muerto de Investigación (`PasoInvestigacion`, la rama `tab === 'investigacion'`).
- Decidir con qué paso se abre la ficha: lo lógico es el primer paso **sin terminar** del mes, o Ideas. Y renombrar el id `edicion` a `publicar`, manteniendo un alias para no romper los enlaces viejos.

---

## Paso 5: Seguimiento

### Para qué sirve
Ver cómo ha ido lo publicado: métricas reales de Instagram del cliente (`src/components/SeguimientoCliente.jsx`).

### Qué ve el gestor
- Según el estado: «La conexión con Instagram todavía no está configurada.», el aviso de plan, o «Conecta la cuenta profesional de Instagram del cliente…» con «Conectar Instagram».
- Conectado: tarjeta «Instagram · @usuario · últimos 30 días» con «Actualizar» y cifras (Seguidores, Alcance, Visualizaciones, Interacciones, Cuentas que interactuaron, Me gusta, Comentarios, Guardados, Compartidos, Tasa de interacción…). Después, la evolución diaria.
- Tarjeta «Publicaciones de octubre» (o «Publicaciones recientes» con «Este mes todavía no hay publicaciones en Instagram. Estas son las más recientes.»), con una tabla: Alcance, Visualizaciones, Me gusta, Comentarios, Guardados, Compartidos, Interacción, «Visto de media», «Lo saltaron», y los botones «Estudiar» y «Variantes Trial» por reel. Las que vienen del calendario llevan «· del calendario». Al pie: «Hay N publicaciones del calendario de este mes, con fecha pasada, que no aparecen en Instagram.»
- Rendimiento por formato y audiencia.
- Tarjeta «Estudiar un vídeo antes de publicarlo» con «Subir vídeo».
- Al final, los **DMs automáticos** (`DmAutomaticos`, `SeguimientoCliente.jsx:508`).

### Qué no se entiende
- **Dos periodos mezclados:** las cifras de arriba son de los «últimos 30 días» y la tabla es del mes natural en curso (`SeguimientoCliente.jsx:203-206`). En la segunda mitad del mes no cuadran.
- **El paso nunca se marca como hecho** (`ProcesoCliente.jsx:63`, `done: false` siempre). El círculo de Seguimiento no se pone verde nunca.
- **Hay cosas que no son seguimiento:** «Estudiar un vídeo **antes de publicarlo**» es trabajo previo a Publicar, y los DMs automáticos son una herramienta aparte (ya está en el menú, «DMs automáticos»).
- El aviso «Hay N publicaciones… que no aparecen en Instagram» no lleva a ningún sitio para arreglarlo.

### Saltos a otras pantallas
- «Conectar Instagram» / «Volver a conectar Instagram» → OAuth de Instagram.
- Icono de enlace en cada publicación → Instagram.
- No tiene enlaces hacia los pasos anteriores.

### Propuesta
- Un solo periodo en toda la pantalla: el **mes que se ve** en la ficha, con «últimos 30 días» como opción aparte si se quiere.
- Definir qué es «hecho» en Seguimiento. Por ejemplo, un botón «Revisado» o «Informe enviado» por mes, como los pasos personalizados (`PasoPersonalizado` ya tiene «Marcar como hecho en <mes>»). Si no, quitarle el círculo numerado.
- Mover «Estudiar un vídeo antes de publicarlo» al paso Publicar (junto al post) y dejar los DMs solo en su herramienta (o en Perfil).
- Que el aviso de publicaciones que faltan enlace al paso Publicar de ese mes.

---

## Páginas duplicadas del menú

El menú (`src/components/Sidebar.jsx:26-46`) tiene, además de la ficha del cliente, estas entradas, que repiten partes del proceso:

| Menú | Ruta / archivo | Qué es | Qué duplica |
|---|---|---|---|
| Contenido | `/contenido` → `src/pages/Contenido.jsx` | Tablero o lista de **todas las piezas de todos los clientes** de un mes, por etapa (Idea, Guion, Cambios pedidos, Aprobado, Publicado) | Las etapas no son los 5 pasos (no hay Grabación). «Idea» quiere decir «post sin guion», no las ideas del plan, que aquí no aparecen. Tampoco salen los guiones sin fecha (usa `getPostsMesTodos` sin `incluirSinProgramar`), así que lo recién guionizado es invisible. «Marcar como publicado» es otra forma de cambiar el estado. «Abrir en Guiones del mes» va a `/guiones-del-mes` **sin `?mes`** (`Contenido.jsx:248-251`) y abre el mes en curso, no el de la pieza. |
| Contenido › Calendario | `/calendario` → `src/pages/CalendarioGeneral.jsx` | «Calendario general»: posts de todos los clientes y tareas pendientes | Pulsar un post lleva a la ficha › Publicar, pero en el mes en curso. En el menú se llama «Calendario» y en la página «Calendario general». |
| Contenido › Guiones del mes | `/guiones-del-mes` → `GuionesMes.jsx` sin embeber | **La misma pantalla que el paso Guiones**, con selector de cliente | Es idéntica al paso 2, incluido el bloque de ideas. Su lista vacía manda a «Lluvia de ideas» (`/lluvia-de-ideas`) en vez de a «Preparar el mes», y «Ir al calendario» abre la ficha sin decir el paso (cae en Publicar solo porque es el paso por defecto). |
| Herramientas › Ideas y guiones | `/guiones` → `src/pages/GuionesVirales.jsx` | «Ideas y Guiones»: elegir cliente y crear un guion desde un tema o desde «Usar idea del calendario» | Es una **tercera** forma de crear guiones, fuera del plan del mes. |
| Herramientas › Lluvia de ideas | `/lluvia-de-ideas` → `src/pages/LluviaDeIdeas.jsx` | Generar ideas sueltas, guardarlas y generar sus guiones | Es otra forma de sacar ideas, distinta de «Preparar el mes». Las ideas guardadas aquí no llevan mes del plan (`crearIdea({ ...idea, clienteId })`) y en Guiones salen según la fecha en que se guardaron. Usa el mismo bloque de ideas con otros nombres («Ideas guardadas este mes», «Generar guiones», «Desarrollar»). Su comentario dice que se incrusta en el paso Ideas, y ya no es así (`LluviaDeIdeas.jsx:190-195`, `ClienteDetalle.jsx:39`). |
| Herramientas › Programar publicaciones | `/instagram/programar` → `src/pages/InstagramProgramar.jsx` | El mismo `CalendarioPublicacion`, solo con posts de Instagram y sin huecos | Es el paso Publicar con otro filtro. |
| Herramientas › Métricas Instagram | `/instagram/metricas` → `src/pages/InstagramMetricas.jsx` | El mismo `SeguimientoCliente`, sin DMs | Es el paso Seguimiento. |

Además, la paleta de comandos (`src/components/paletaComandosAcciones.js:25-41`) tiene accesos directos a «Guiones del mes», «Calendario», «Contenido» y «Lluvia de ideas».

### Propuesta
- **Una sola casa para el trabajo de un cliente: la ficha.** Las páginas del menú quedan solo como **vistas de todos los clientes** que llevan a la ficha en el paso y el mes correctos:
  - **Contenido** (tablero de todos los clientes) se queda, pero con las columnas iguales a los 5 pasos (Ideas → Guiones → Grabación → Publicar → Publicado), incluidos los guiones sin fecha. Cada pieza lleva a `/clientes/:id?mes=AAAA-MM` en el paso que le toca.
  - **Calendario** (general) se queda. Al pulsar un post abre la ficha › Publicar **en el mes del post**.
  - **Guiones del mes** como página suelta: quitarla del menú y redirigir `/guiones-del-mes?mes=…` a la ficha del cliente activo (`/clientes/:id?mes=…`, paso Guiones), para no romper enlaces viejos.
  - **Programar publicaciones** y **Métricas Instagram**: dejarlas en Herramientas (son útiles para quien solo publica o solo mira métricas), pero con un enlace «Abrir en la ficha del cliente».
  - **Lluvia de ideas** e **Ideas y guiones**: decidir si se mantienen como herramientas sueltas. Si se mantienen, que «Guardar» pregunte a qué mes va la idea y que se vea en el paso Ideas de ese mes. **Ideas y guiones** es la candidata más clara a desaparecer, porque hace lo mismo que Guiones › «Escribir guion».

---

## Otros problemas transversales

1. **Cada paso usa un mes distinto.** Es lo que más confunde. Hoy en `main`:

   | Sitio | Mes que enseña | Dónde |
   |---|---|---|
   | Encabezado «Proceso de <mes>» | mes en curso | `ClienteNavegacion.jsx:27` (lo arregla el PR #114, **en curso**, leyendo `?mes`) |
   | Contadores de los pasos | mes en curso | `ProcesoCliente.jsx:69-70` (PR #114, **en curso**) |
   | Ideas (Preparar el mes) | **mes siguiente**, estado interno, no lee ni escribe `?mes` | `PrepararMes.jsx:38` |
   | Guiones | `?mes` o mes en curso; las flechas **borran** `?mes` | `GuionesMes.jsx:464-465, 519-523` |
   | Grabación | mes en curso, sin flechas | `PasosCliente.jsx:229-232` |
   | Publicar (calendario) | mes en curso, flechas propias | `CalendarioPublicacion.jsx:272` |
   | Seguimiento | mes en curso, más «últimos 30 días» | `SeguimientoCliente.jsx:203-206` |
   | Pasos personalizados | mes en curso | `PasosCliente.jsx:281-283` |

   Aunque se aplique el PR #114, el encabezado y los checks solo coincidirán con lo que se ve justo después de «Generar ideas» (el único sitio que pone `?mes`). En cuanto se usan las flechas de Guiones o se va a Grabación o Publicar, vuelven a no coincidir.

   **Propuesta:** un único «mes de la ficha» en `?mes=AAAA-MM`, leído en `ClienteDetalle` y pasado como prop a todos los pasos. Que un selector ‹ mes › **junto al encabezado** («Contenido de noviembre ‹ ›») sustituya a las flechas sueltas de Ideas, Guiones y el calendario. Por defecto, el mes en curso o, si se prefiere trabajar «a un mes vista», el siguiente. Decidirlo una vez para todos.

2. **El mismo estado guardado en varios sitios que no se hablan.**
   - Grabado: casillas en localStorage, `grabadoEn` y la columna «Por grabar» del tablero.
   - Publicado: `post.estado` marcado a mano en el calendario, «Marcar como publicado» en Contenido y el estado de la publicación en Instagram.
   - Etapa: las etapas de Contenido (`src/utils/etapaContenido.js`) no son los pasos del proceso.

   **Propuesta:** una función única `etapaDePieza(post, tarea)` que diga en qué paso está cada pieza, y que la usen la ficha, Contenido y el tablero.

3. **Cada paso decide «hecho» a su manera:**
   - Ideas: hay posts (no ideas).
   - Guiones: todos los **vídeos** con guion y aprobados (los carruseles no cuentan).
   - Grabación: todas las casillas marcadas en este navegador.
   - Publicar: todos los posts del mes publicados (incluidos los que no están en el calendario).
   - Seguimiento: nunca.

   **Propuesta:** escribir en un sitio (`src/utils/pasosCliente.js`) la definición de «hecho» de cada paso, con el mismo mes y los mismos datos que enseña la pantalla, y que el check del encabezado y la pantalla usen esa misma función.

4. **Botones con el mismo nombre que hacen cosas distintas:**
   - «Regenerar guion»: con modal desde la idea, directo desde el guion.
   - «Regenerar»: rehace la idea, no el guion.
   - «Nuevo post»: crea un post o programa un guion.
   - «Contenido»: subvista del paso Publicar y página del menú.
   - «Hoja de rodaje»: panel lateral en Guiones, pantalla en Grabación.
   - «Exportar PDF»: el de Guiones exporta los guiones; el de la hoja, la hoja de rodaje. Este último está bien, pero conviene que el texto diga qué exporta.

5. **Saltos que pierden el mes o el paso:**
   - Contenido › «Abrir en Guiones del mes» (sin `?mes`).
   - Calendario general › post (abre el mes en curso).
   - Guiones del mes suelto › «Ir al calendario» (sin paso).
   - Tareas de producción (`paso: 'grabacion'`) abren el paso Guiones, no Grabación (`ToDo.jsx:556-562`).

6. **La ficha se abre en «Publicar»** (paso 4) y no en el paso que toca.

7. **Restos de «Investigación».** El texto «Marcada en Investigación» aparece en el calendario. Queda código que no se puede abrir: `PasoInvestigacion` y la rama `tab === 'investigacion'` en `ClienteDetalle.jsx`. Y hay comentarios que todavía hablan de «seis pasos» (`ProcesoCliente.jsx:8`, `ClienteDetalle.jsx:1542`, `pasosCliente.js:2, 29, 72`) cuando son cinco.

8. **Acciones que borran sin confirmar:** «Reemplazar las que no tienen guion» (Ideas) y «Reiniciar» (hoja de rodaje). La papelera de ideas y guiones sí pide un segundo clic.

---

## Tabla final

Ordenada de lo que más confunde (arriba) a lo que menos. Esfuerzo orientativo: S = horas, M = uno o dos días, L = varios días o toca datos.

| Problema | Propuesta | Archivos | Esfuerzo |
|---|---|---|---|
| Cada paso enseña un mes distinto (Ideas el siguiente; Guiones `?mes` o el actual; Grabación, Publicar y Seguimiento el actual); las flechas de Guiones borran `?mes`, así que el encabezado del PR #114 vuelve a no cuadrar | Un único mes de ficha en `?mes`, con selector junto al encabezado y pasado como prop a todos los pasos; quitar las flechas sueltas o hacer que escriban `?mes` | `src/pages/ClienteDetalle.jsx`, `src/components/ClienteNavegacion.jsx`, `src/components/PrepararMes.jsx`, `src/pages/GuionesMes.jsx`, `src/components/PasosCliente.jsx`, `src/components/CalendarioPublicacion.jsx`, `src/components/SeguimientoCliente.jsx` | M |
| El paso Ideas no enseña las ideas; están arriba de Guiones, y ahí cada pieza guionizada sale dos veces (idea «Con guion» + guion) | Mover la lista «Ideas de <mes>» al paso Ideas, debajo del plan; en Guiones solo guiones y un enlace a las ideas | `src/components/PrepararMes.jsx`, `src/components/IdeasGuardadasMes.jsx`, `src/pages/GuionesMes.jsx`, `src/pages/ClienteDetalle.jsx` | M |
| Grabación enseña la hoja del mes en curso, cuando se graba lo del mes siguiente, y no tiene flechas | Usar el mes de la ficha; mientras tanto, añadir flechas de mes | `src/components/PasosCliente.jsx` (`PasoGrabacion`) | S |
| La fecha de grabación se fija en tres sitios (Guiones › Producción, tareas de Grabación) y Grabación dice que «llegará en una fase posterior» | Mover `PlanProduccion` al paso Grabación y borrar la tarjeta provisional; «Fija el día de grabación primero» con botón «Ir a Grabación» | `src/components/PlanProduccion.jsx`, `src/components/PasosCliente.jsx`, `src/pages/GuionesMes.jsx` | S |
| Los checks y contadores de los pasos no miden lo que dicen: Ideas cuenta posts, Guiones solo vídeos, Publicar incluye guiones sin fecha y otras redes, Seguimiento nunca se completa (el PR #114 cambia el texto, pero no las reglas) | Definir «hecho» por paso en `pasosCliente.js` con los mismos datos que la pantalla (ideas reales, piezas en calendario, etc.); dar a Seguimiento un «Revisado» mensual | `src/components/ProcesoCliente.jsx`, `src/utils/pasosCliente.js` | M |
| Lo grabado se guarda solo en el navegador hasta completar un vídeo; el número del paso y el de la hoja no coinciden; la casilla no tiene texto | Guardar las marcas por plano en la base de datos; misma cuenta en paso y hoja; texto «Grabado» en la casilla | `src/components/HojaRodaje.jsx`, `src/components/ProcesoCliente.jsx`, `src/utils/hojaRodaje.js`, `src/hooks/useCalendario.js` (+ migración) | L |
| Dos formas de poner un guion en el calendario con reglas distintas («Añadir al calendario» tras grabar vs. «Nuevo post» siempre); «Nuevo post» hace dos cosas | Un bloque fijo «Listos para publicar» en Publicar, con una sola regla; «Nuevo post» solo para posts sueltos | `src/components/CalendarioPublicacion.jsx`, `src/pages/GuionesMes.jsx` | M |
| «Guiones del mes», «Calendario», «Programar publicaciones» y «Métricas Instagram» del menú son copias de pasos de la ficha | Dejar en el menú solo las vistas de todos los clientes (Contenido, Calendario general) que llevan a la ficha; redirigir `/guiones-del-mes` a la ficha; enlace «Abrir en la ficha» en las herramientas | `src/components/Sidebar.jsx`, `src/App.jsx`, `src/pages/GuionesMes.jsx`, `src/pages/InstagramProgramar.jsx`, `src/pages/InstagramMetricas.jsx`, `src/components/paletaComandosAcciones.js` | M |
| Saltos que pierden el mes: Contenido › «Abrir en Guiones del mes» sin `?mes`; Calendario general › post abre el mes en curso; tareas de producción abren Guiones | Pasar siempre `?mes=AAAA-MM` y el paso correcto al navegar a la ficha | `src/pages/Contenido.jsx:248-251`, `src/pages/CalendarioGeneral.jsx:121`, `src/pages/ToDo.jsx:554-565` | S |
| La página Contenido no enseña ideas ni guiones sin fecha, y sus etapas no son los pasos | Incluir los sin programar (`incluirSinProgramar`) y alinear las columnas con los 5 pasos | `src/pages/Contenido.jsx`, `src/utils/etapaContenido.js`, `src/hooks/useCalendario.js` | M |
| Mismo nombre, distinta acción: «Regenerar guion» (modal vs. directo), «Regenerar» (idea); cuatro nombres para guionizar | Un verbo por acción: «Guionizar», «Rehacer idea», «Regenerar guion» (solo dentro del guion) | `src/components/IdeasGuardadasMes.jsx`, `src/pages/GuionesMes.jsx`, `src/pages/LluviaDeIdeas.jsx` | S |
| Subvista «Contenido» en Publicar: se llama como la página del menú, repite Guiones de todos los meses, tiene un texto vacío antiguo y fechas `AAAA-MM-DD` (el día 1 en los sin fecha) | Quitarla, o renombrarla a «Archivo de guiones» con fechas legibles | `src/pages/ClienteDetalle.jsx` (`TabContenido`, `SubvistaEdicion`) | S |
| Cifras sin etiqueta: «Ideas de noviembre · 25», «vídeos este mes» viendo otro mes, «Sin fecha» (la fecha suelta de cada idea la quita el PR #115, **en curso**) | «25 ideas · 8 sin guion», «vídeos en <mes>», «Sin publicar en el calendario» | `src/components/IdeasGuardadasMes.jsx:182`, `src/pages/GuionesMes.jsx:634`, `GuionesMes.jsx` (`FilaGuion`) | S |
| La ficha se abre en «Publicar» (paso 4) | Abrir en el primer paso sin terminar del mes, o en Ideas | `src/utils/pasosCliente.js:19`, `src/pages/ClienteDetalle.jsx:1492-1497` | S |
| Seguimiento mezcla «últimos 30 días» con el mes natural e incluye cosas que no son seguimiento (estudiar antes de publicar, DMs) | Un solo periodo (mes de la ficha); mover «Estudiar un vídeo» a Publicar y dejar los DMs en su herramienta | `src/components/SeguimientoCliente.jsx` | M |
| «Grabado» no mueve la tarjeta del tablero a «Por editar»; el estado «publicado» se marca en tres sitios | Al completar un vídeo, mover su tarea a «Por editar»; una sola función de etapa por pieza | `src/components/HojaRodaje.jsx`, `src/services/tareasAutomaticas.js`, `src/pages/Contenido.jsx`, `src/components/CalendarioPublicacion.jsx` | M |
| Restos de «Investigación» («Marcada en Investigación» en el calendario, `PasoInvestigacion` inalcanzable, comentarios de «seis pasos»); id `edicion` para «Publicar» | Cambiar el texto a «Fecha marcada», borrar el código muerto, renombrar el id a `publicar` con alias | `src/components/CalendarioPublicacion.jsx:184`, `src/components/PasosCliente.jsx`, `src/pages/ClienteDetalle.jsx`, `src/utils/pasosCliente.js`, `src/components/ProcesoCliente.jsx` | S |
| «Reemplazar las que no tienen guion» y «Reiniciar» (hoja de rodaje) borran sin confirmar | Pedir confirmación con un segundo clic, como la papelera | `src/components/PrepararMes.jsx`, `src/components/HojaRodaje.jsx` | S |
