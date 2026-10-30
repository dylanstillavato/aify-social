// La marca de Aify («@ Aify», «@ Aify Social»…) como imagen. Los SVG de
// public/marca/ llevan el texto convertido en trazados, así que no hace falta
// cargar (ni redistribuir) la fuente con la que se dibujaron.
//
// `tamano` es el cuerpo de letra que tenía el texto cuando se pintaba con
// fuente: los SVG miden 1088 unidades de alto para un cuerpo de 1000, así que a
// tamano × 1,088 px de alto el texto sale exactamente del mismo tamaño.
// `oscuro` es para fondos oscuros (marca en blanco); sin él, tinta oscura.

const ALTO_POR_PUNTO = 1.088

const ARCHIVOS = {
  Social: 'marca-aify-social',
  Pictures: 'marca-aify-pictures',
  Film: 'marca-aify-film',
}

function srcMarca(app, oscuro = false) {
  const base = ARCHIVOS[app] || 'marca-aify'
  return `/marca/${base}-${oscuro ? 'oscuro' : 'claro'}.svg`
}

export default function Marca({ app, oscuro = false, tamano = 17, style }) {
  return (
    <img
      src={srcMarca(app, oscuro)}
      alt={app ? `Aify ${app}` : 'Aify'}
      style={{ display: 'block', height: Math.round(tamano * ALTO_POR_PUNTO * 10) / 10, width: 'auto', flexShrink: 0, ...style }}
    />
  )
}
