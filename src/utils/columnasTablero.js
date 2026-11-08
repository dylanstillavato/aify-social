// Columnas con las que nace cada tablero. Sin dependencias: lo usan la web
// (useTableros.js) y el servidor (mcp/tareas.js).
export const COLUMNAS_POR_DEFECTO = {
  tareas: [
    { nombre: 'Por grabar', color: '#1D5FE0' },
    { nombre: 'Por editar', color: '#FF9500' },
    { nombre: 'Por publicar', color: '#AF52DE' },
    { nombre: 'Hecho', color: '#30D158', esFinal: true },
  ],
  clientes: [
    { nombre: 'Presupuesto enviado', color: '#86868B' },
    { nombre: 'Presupuesto firmado', color: '#3D9BFF' },
    { nombre: 'Onboarding', color: '#1D5FE0' },
    { nombre: 'Guiones aprobados', color: '#AF52DE' },
    { nombre: 'Día de grabación', color: '#FF2D55' },
    { nombre: 'En edición', color: '#FF9500' },
    { nombre: 'Vídeos entregados', color: '#64D2FF' },
    { nombre: 'Pagado', color: '#30D158' },
  ],
}
