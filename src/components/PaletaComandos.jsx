import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Search, User, CornerDownLeft } from 'lucide-react'
import { useClientesList } from '../hooks/useClientes'
import { useClienteActivo } from '../hooks/useClienteActivo'
import { ACCIONES_PALETA, EVENTO_ABRIR_COMANDOS } from './paletaComandosAcciones'

const GRUPOS = { crear: 'Crear', clientes: 'Clientes', ir: 'Ir a' }
const ORDEN_GRUPOS = ['crear', 'clientes', 'ir']
const MAX_CLIENTES_SIN_QUERY = 6

function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Relevancia de un item para la búsqueda (0 = no coincide). Sin query todo
// coincide con la misma puntuación y se respeta el orden de ORDEN_GRUPOS.
//   5 etiqueta exacta · 4 etiqueta empieza por la query · 3 una palabra de la
//   etiqueta empieza por la query · 2 la etiqueta contiene la query ·
//   1 solo coincide en las keywords
function puntuar(item, q) {
  if (!q) return 1
  const label = normalizar(item.label)
  if (label === q) return 5
  if (label.startsWith(q)) return 4
  if (label.split(/[^a-z0-9]+/).some(p => p && p.startsWith(q))) return 3
  if (label.includes(q)) return 2
  if (normalizar(item.keywords).includes(q)) return 1
  return 0
}

// Filtra y ordena por relevancia (sort estable: a igual puntuación, se
// mantiene el orden declarado)
function rankear(items, q) {
  return items
    .map(item => ({ item, score: puntuar(item, q) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

export default function PaletaComandos() {
  const navigate = useNavigate()
  const reducirMovimiento = useReducedMotion()
  const { clientes } = useClientesList()
  const { setClienteActivoId } = useClienteActivo()
  const [abierta, setAbierta] = useState(false)
  const [query, setQuery] = useState('')
  const [activo, setActivo] = useState(0)
  const listaRef = useRef(null)
  const focoPrevioRef = useRef(null)
  const baseId = useId()
  const listboxId = `${baseId}-lista`
  const optionId = (i) => `${baseId}-opcion-${i}`

  const abrir = useCallback(() => {
    focoPrevioRef.current = document.activeElement
    setQuery('')
    setActivo(0)
    setAbierta(true)
  }, [])

  const cerrar = useCallback((restaurarFoco = true) => {
    setAbierta(false)
    const previo = focoPrevioRef.current
    focoPrevioRef.current = null
    if (restaurarFoco && previo && typeof previo.focus === 'function' && document.contains(previo)) {
      // Tras desmontar el diálogo, para que el foco no vuelva a caer en él
      requestAnimationFrame(() => previo.focus())
    }
  }, [])

  // Atajo global Cmd+K / Ctrl+K y evento 'aify:abrir-comandos'
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (abierta) cerrar()
        else abrir()
      } else if (abierta && e.key === 'Escape') {
        e.preventDefault()
        cerrar()
      }
    }
    const onEvento = () => { if (!abierta) abrir() }
    window.addEventListener('keydown', onKey)
    window.addEventListener(EVENTO_ABRIR_COMANDOS, onEvento)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(EVENTO_ABRIR_COMANDOS, onEvento)
    }
  }, [abierta, abrir, cerrar])

  const grupos = useMemo(() => {
    const q = normalizar(query)
    const itemsClientes = (clientes || [])
      .map(c => ({
        id: `cliente-${c.id}`,
        grupo: 'clientes',
        label: c.nombre || 'Sin nombre',
        icon: User,
        hint: c.sectorCustom || c.sector || '',
        keywords: `${c.sector || ''} ${c.sectorCustom || ''}`,
        run: ({ navigate: nav }) => {
          setClienteActivoId(String(c.id))
          nav(`/clientes/${c.id}`)
        },
      }))
    const porGrupo = {
      crear: rankear(ACCIONES_PALETA.filter(a => a.grupo === 'crear'), q),
      clientes: rankear(q ? itemsClientes : itemsClientes.slice(0, MAX_CLIENTES_SIN_QUERY), q),
      ir: rankear(ACCIONES_PALETA.filter(a => a.grupo === 'ir'), q),
    }
    // Con query, los grupos se ordenan por su mejor resultado: así la primera
    // fila (la que ejecuta Enter) es siempre la coincidencia más relevante,
    // sea del grupo que sea. Sin query, orden fijo (sort estable).
    return ORDEN_GRUPOS
      .map(g => ({ id: g, label: GRUPOS[g], mejor: porGrupo[g][0]?.score || 0, items: porGrupo[g].map(r => r.item) }))
      .filter(g => g.items.length > 0)
      .sort((a, b) => b.mejor - a.mejor)
  }, [clientes, query, setClienteActivoId])

  const planos = useMemo(() => grupos.flatMap(g => g.items), [grupos])
  // Índice global de la primera fila de cada grupo (para ids y teclado)
  const inicios = useMemo(() => {
    const r = []
    let acc = 0
    for (const g of grupos) { r.push(acc); acc += g.items.length }
    return r
  }, [grupos])
  const total = planos.length
  const indiceActivo = total === 0 ? -1 : Math.min(activo, total - 1)

  // Mantiene visible la fila activa al navegar con el teclado
  useEffect(() => {
    if (!abierta || indiceActivo < 0) return
    const el = listaRef.current?.querySelector(`[data-indice="${indiceActivo}"]`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [abierta, indiceActivo])

  const ejecutar = (item) => {
    if (!item) return
    // La navegación lleva a otra página: no se restaura el foco anterior
    cerrar(false)
    if (typeof item.run === 'function') item.run({ navigate })
    else if (item.to) navigate(item.to)
  }

  const onKeyDownInput = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (total) setActivo((indiceActivo + 1) % total)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (total) setActivo((indiceActivo - 1 + total) % total)
    } else if (e.key === 'Home') {
      if (total) { e.preventDefault(); setActivo(0) }
    } else if (e.key === 'End') {
      if (total) { e.preventDefault(); setActivo(total - 1) }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      ejecutar(planos[indiceActivo])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar()
    } else if (e.key === 'Tab') {
      // Único elemento enfocable del diálogo: mantener el foco dentro
      e.preventDefault()
    }
  }

  const duracion = reducirMovimiento ? 0 : 0.14

  return (
    <AnimatePresence>
      {abierta && (
        <>
          <motion.div
            key="paleta-fondo"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: duracion }}
            onClick={cerrar}
            style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          />
          <div
            key="paleta-contenedor"
            style={{ position: 'fixed', inset: 0, zIndex: 1101, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '12vh 16px 16px', pointerEvents: 'none' }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Paleta de comandos"
              initial={reducirMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -8 }}
              animate={reducirMovimiento ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reducirMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -4 }}
              transition={{ duration: duracion, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                pointerEvents: 'auto', width: '100%', maxWidth: 580,
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14,
                boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', maxHeight: '70vh',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <Search size={17} color="var(--text-tertiary)" strokeWidth={2} aria-hidden="true" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActivo(0) }}
                  onKeyDown={onKeyDownInput}
                  placeholder="Buscar o crear…"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={indiceActivo >= 0 ? optionId(indiceActivo) : undefined}
                  aria-label="Buscar o crear"
                  spellCheck={false}
                  autoComplete="off"
                  style={{
                    flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 15, color: 'var(--text-primary)', fontFamily: 'inherit',
                  }}
                />
              </div>

              <div
                ref={listaRef}
                id={listboxId}
                role="listbox"
                aria-label="Resultados"
                style={{ overflowY: 'auto', padding: '6px 8px 8px', flex: 1 }}
              >
                {total === 0 ? (
                  <div style={{ padding: '22px 12px', textAlign: 'center', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                    Sin resultados para «{query}»
                  </div>
                ) : grupos.map((g, gi) => (
                  <div key={g.id} role="group" aria-labelledby={`${baseId}-grupo-${g.id}`}>
                    <div
                      id={`${baseId}-grupo-${g.id}`}
                      style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', padding: '10px 10px 4px' }}
                    >
                      {g.label}
                    </div>
                    {g.items.map((item, j) => {
                      const i = inicios[gi] + j
                      const seleccionada = i === indiceActivo
                      const Icono = item.icon
                      return (
                        <div
                          key={item.id}
                          id={optionId(i)}
                          data-indice={i}
                          role="option"
                          aria-selected={seleccionada}
                          onMouseMove={() => { if (activo !== i) setActivo(i) }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => ejecutar(item)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                            background: seleccionada ? 'rgba(29,95,224,0.1)' : 'transparent',
                            color: seleccionada ? 'var(--accent-blue, #1D5FE0)' : 'var(--text-primary)',
                          }}
                        >
                          {Icono && (
                            <Icono
                              size={16}
                              strokeWidth={seleccionada ? 2.2 : 1.8}
                              color={seleccionada ? 'var(--accent-blue, #1D5FE0)' : 'var(--text-secondary)'}
                              aria-hidden="true"
                            />
                          )}
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: seleccionada ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                          {item.hint && (
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.hint}
                            </span>
                          )}
                          {seleccionada && (
                            <CornerDownLeft size={13} color="var(--text-tertiary)" aria-hidden="true" style={{ flexShrink: 0 }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div style={{ padding: '9px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                ↑↓ para moverte · Enter para abrir · Esc para cerrar
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
