import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RefreshCw, Unlink } from 'lucide-react'
import { Tarjeta, Aviso } from './instagramUi'
import { botonPrimario, botonSecundario, textoSecundario } from './instagramEstilos'
import { getEstadoTikTok, conectarTikTok, desconectarTikTok, MOTIVOS_ERROR_CONEXION_TIKTOK } from '../services/tiktok'
import MetricasTikTok from './MetricasTikTok'

// Conectar / desconectar el TikTok del cliente en el paso Seguimiento, debajo
// de Instagram. Conectado, sirve para publicar desde el calendario y debajo
// salen sus métricas (MetricasTikTok).

function mensajeRetorno(search) {
  const params = new URLSearchParams(search)
  const resultado = params.get('tiktok')
  if (resultado === 'conectado') return { tono: 'ok', texto: 'TikTok conectado. Ya puedes ver sus métricas y publicar en TikTok desde el calendario.' }
  if (resultado === 'error') return { tono: 'error', texto: MOTIVOS_ERROR_CONEXION_TIKTOK[params.get('motivo')] || MOTIVOS_ERROR_CONEXION_TIKTOK.error }
  return null
}

export default function ConexionTikTok({ clienteId }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [retorno] = useState(() => mensajeRetorno(location.search))
  const [recarga, setRecarga] = useState(0)
  const clave = `${clienteId}|${recarga}`
  const [estado, setEstado] = useState(null) // { clave, data?, error? }
  const [conectando, setConectando] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)

  // Limpia ?tiktok=... de la URL tras leerlo, para que no reaparezca.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (!params.has('tiktok')) return
    params.delete('tiktok')
    params.delete('motivo')
    const query = params.toString()
    navigate(`${location.pathname}${query ? `?${query}` : ''}`, { replace: true })
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    if (!clienteId) return
    let activo = true
    getEstadoTikTok(clienteId)
      .then(data => { if (activo) setEstado({ clave, data }) })
      .catch(error => { if (activo) setEstado({ clave, error }) })
    return () => { activo = false }
  }, [clienteId, clave])

  const conectar = async () => {
    setConectando(true)
    setErrorAccion(null)
    try {
      await conectarTikTok(clienteId)
    } catch (err) {
      setErrorAccion(err.message)
      setConectando(false)
    }
  }

  const desconectar = async () => {
    if (!window.confirm('¿Desconectar TikTok de este cliente? Se quitará el permiso a Aify, se borrarán sus métricas guardadas y no se podrá publicar en su TikTok hasta volver a conectarlo.')) return
    setErrorAccion(null)
    try {
      await desconectarTikTok(clienteId)
      setRecarga(r => r + 1)
    } catch (err) {
      setErrorAccion(err.message)
    }
  }

  if (!clienteId) return null
  const actual = estado?.clave === clave ? estado : null
  const avisos = (
    <>
      {retorno && <Aviso tono={retorno.tono}>{retorno.texto}</Aviso>}
      {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}
    </>
  )

  if (!actual) return <Tarjeta titulo="TikTok">{avisos}<p style={textoSecundario}>Comprobando TikTok…</p></Tarjeta>
  if (actual.error) {
    return (
      <Tarjeta titulo="TikTok">
        {avisos}
        <Aviso tono="error">{actual.error.message}</Aviso>
        <button type="button" style={botonSecundario} onClick={() => setRecarga(r => r + 1)}><RefreshCw size={13} /> Reintentar</button>
      </Tarjeta>
    )
  }

  const { configurado, conectado, conexion } = actual.data
  if (!configurado) return <Tarjeta titulo="TikTok">{avisos}<p style={textoSecundario}>La conexión con TikTok todavía no está configurada.</p></Tarjeta>

  if (!conectado) {
    const caducada = conexion?.estado === 'caducada'
    return (
      <Tarjeta titulo="TikTok">
        {avisos}
        <p style={{ ...textoSecundario, marginBottom: 14 }}>
          {caducada
            ? `El permiso de ${conexion.username ? `@${conexion.username}` : 'la cuenta'} caducó o se quitó. Vuelve a conectarla para seguir publicando en TikTok.`
            : 'Conecta la cuenta de TikTok del cliente para ver sus métricas y programar y publicar vídeos y fotos desde el calendario.'}
        </p>
        <button type="button" style={{ ...botonPrimario, opacity: conectando ? 0.7 : 1, cursor: conectando ? 'wait' : 'pointer' }} onClick={conectar} disabled={conectando}>
          {conectando ? 'Abriendo TikTok…' : caducada ? 'Volver a conectar TikTok' : 'Conectar TikTok'}
        </button>
      </Tarjeta>
    )
  }

  const puedePublicar = (conexion?.permisos || []).includes('video.publish')
  return (
    <>
      <Tarjeta titulo={conexion?.username ? `TikTok · @${conexion.username}` : 'TikTok'} accion={
        <button type="button" style={botonSecundario} onClick={desconectar}><Unlink size={13} /> Desconectar</button>
      }>
        {avisos}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {conexion?.avatar_url
            ? <img src={conexion.avatar_url} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-secondary)', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{conexion?.nombre || conexion?.username || 'Cuenta de TikTok'}</div>
            <p style={{ ...textoSecundario, fontSize: 12 }}>
              {puedePublicar
                ? 'Conectada. Programa sus vídeos y fotos desde el calendario.'
                : 'Conectada sin permiso para publicar: vuelve a conectarla aceptando todos los permisos.'}
            </p>
          </div>
        </div>
        {!puedePublicar && (
          <button type="button" style={{ ...botonPrimario, marginTop: 12 }} onClick={conectar} disabled={conectando}>Volver a conectar TikTok</button>
        )}
      </Tarjeta>
      <MetricasTikTok clienteId={clienteId} usuario={conexion?.username} onReconectar={conectar} />
    </>
  )
}
