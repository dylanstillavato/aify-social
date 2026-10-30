// Artículo 1 del blog. Solo el cuerpo: título, fecha, caja de autor y CTA
// los pone BlogArticulo (src/pages/blog/Blog.jsx). Texto final del encargo
// #61, sin datos añadidos.
export default function PorQueSaltanTusReels() {
  return (
    <>
      <p>
        En octubre medimos todo lo que publicamos para dos restaurantes que llevamos en Valencia: once publicaciones, nueve de ellas reels. El dato que más nos preocupó no fue el alcance ni los me gusta. Fue otro: en cinco de esos nueve reels, más del 65 % de la gente lo pasó de largo nada más empezar.
      </p>
      <p>
        Si un reel pierde a dos de cada tres personas en el primer segundo, da igual lo bueno que sea lo que viene después. Nadie llega a verlo.
      </p>

      <h2>Qué es «lo saltaron» y dónde verlo</h2>
      <p>Instagram da dos datos de retención para cada reel:</p>
      <ul>
        <li><strong>Tiempo visto de media:</strong> cuántos segundos aguanta de media quien lo ve.</li>
        <li><strong>Tasa de omisión</strong> (en Aify la llamamos «lo saltaron»): el porcentaje de gente que pasa al siguiente vídeo en los primeros segundos.</li>
      </ul>
      <p>
        Están en las estadísticas de cada reel, dentro de la app de Instagram. Si usas Aify, salen juntos en la pestaña Seguimiento de cada cliente.
      </p>
      <p>
        La tasa de omisión es el mejor termómetro del gancho, porque solo depende de lo que pasa al principio.
      </p>

      <h2>Lo que encontramos</h2>
      <div className="blog-tabla">
        <table>
          <thead>
            <tr>
              <th>Reel</th>
              <th>Lo saltaron</th>
              <th>Visto de media</th>
              <th>Qué era</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Hamburguesa del mes</td><td>60 %</td><td>13,8 s</td><td>Un producto con su oferta</td></tr>
            <tr><td>Halloween en el restaurante</td><td>66 %</td><td>9,6 s</td><td>Un evento con fecha</td></tr>
            <tr><td>Vídeo cinematográfico de los almuerzos</td><td>71 %</td><td>7,5 s</td><td>Ambiente del local</td></tr>
            <tr><td>Sonido de la campana de cocina</td><td>67,9 %</td><td>6,2 s</td><td>Ambiente del local</td></tr>
            <tr><td>Una noche en el restaurante</td><td>78,9 %</td><td>5,2 s</td><td>Ambiente del local</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        El que mejor retuvo tenía algo concreto que contar desde el principio: un producto, con su precio y su motivo para ir. Fue también el de mejor interacción de su cuenta (11,7 %) y el único reel de esa cuenta que alguien guardó. El evento con fecha, Halloween, no retuvo tanto, pero generó conversación: siete comentarios y seis compartidos. Una fecha invita a etiquetar a alguien.
      </p>
      <p>
        Los que más se saltaron empezaban igual: un plano bonito del local. Bonito no es lo mismo que interesante. En el primer segundo nadie sabe todavía por qué debería quedarse a ver un comedor.
      </p>

      <h2>El caso que más enseña: buen contenido, mal inicio</h2>
      <p>
        «Una noche en el restaurante» fue el reel con peor inicio del mes: el 78,9 % lo saltó. Pero quienes se quedaron lo compartieron nueve veces y lo comentaron cuatro, más que casi cualquier otro. El contenido funcionaba. Lo que fallaba era el primer segundo.
      </p>
      <p>
        Esto cambia lo que hay que arreglar. Muchas veces no hace falta un vídeo nuevo, sino otro arranque para el mismo vídeo.
      </p>

      <h2>Y al revés: retener no basta</h2>
      <p>
        El reel que mejor retuvo de una de las cuentas, con solo un 53 % que lo saltó y 13 segundos de media, tuvo un 0,5 % de interacción: dos me gusta y ni un comentario. La gente se quedó, pero al acabar no tenía nada que hacer. No había una pregunta, ni una oferta, ni un motivo para enviarlo a nadie.
      </p>
      <p>
        El gancho consigue que te vean. El final consigue que hagan algo. Hacen falta las dos cosas.
      </p>

      <h2>Cómo arreglar el primer segundo</h2>
      <p>
        Revisamos los ganchos con cuatro errores, en este orden. El método lo aprendimos de la creadora @tumadreanna.
      </p>
      <ol>
        <li><strong>Retraso.</strong> La primera frase no dice de qué va el vídeo: un saludo, «hoy os traigo», una presentación. El tema tiene que estar en la primera frase, como si fuera un título, en diez palabras o menos.</li>
        <li><strong>Confusión.</strong> Se dice el tema, pero cuesta entenderlo: frases largas, palabras raras o algo que se puede leer de dos maneras.</li>
        <li><strong>Irrelevancia.</strong> Habla de «nosotros» en vez de «tú», o de algo curioso en vez de un problema que el espectador ya tiene.</li>
        <li><strong>Falta de interés.</strong> No hay contraste entre lo que hace todo el mundo y lo que propone el vídeo, así que no abre ninguna pregunta.</li>
      </ol>
      <p>Y en la imagen:</p>
      <ul>
        <li><strong>Texto en pantalla desde el primer fotograma.</strong> El título no puede estar solo en la portada.</li>
        <li><strong>Una persona o movimiento al empezar.</strong> Nada de un plano fijo del local.</li>
        <li><strong>Empieza por el resultado:</strong> el plato terminado, el local lleno, la cara de quien lo prueba. El proceso, después.</li>
      </ul>

      <h2>Antes de publicar, comprueba esto</h2>
      <ul>
        <li>Si quito el sonido, ¿se entiende de qué va en el primer segundo?</li>
        <li>¿La primera frase dice el tema en diez palabras o menos?</li>
        <li>¿Habla de algo que le pasa al que mira, no de nosotros?</li>
        <li>¿Hay alguien o algo moviéndose al empezar?</li>
        <li>¿Al final se pide una sola cosa (guardar, comentar, reservar)?</li>
      </ul>
      <p>
        Si gestionas las redes de varios clientes, esta revisión no puede depender de acordarse. En Aify, el botón «Revisar gancho» pasa cada guion por estos cuatro errores antes de grabar, y la pestaña Seguimiento enseña la tasa de omisión de cada reel cuando ya está publicado. Así se cierra el círculo: escribes, mides y corriges el siguiente.
      </p>
      <p>
        Para saber dónde se te van las horas con varios clientes, mira <a href="/agencias">la guía para agencias</a> o <a href="/checklist">los 5 errores que colapsan un calendario de contenido</a>.
      </p>
    </>
  )
}
