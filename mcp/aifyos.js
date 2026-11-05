// ── Licencia de AifyOS (0056_aifyos_licencias.sql) ────────────────────────────
// Una sola suscripción: 44 €/mes con Stripe. El precio se crea a mano en Stripe y
// llega en STRIPE_PRICE_AIFYOS_MONTHLY; este código nunca crea productos ni precios.
// Mismas reglas que el muro de pago anterior (0013, 0017): el webhook refleja
// Stripe, past_due sigue siendo acceso válido mientras Stripe reintenta el cobro,
// y la cortesía solo se activa a mano.
//
// La licencia es de la organización: vale para cualquier miembro que conecte AifyOS.

export const ESTADOS_SUSCRIPCION_VIVA = ['trialing', 'active', 'past_due']
export const MENSAJE_SIN_MIGRACION_AIFYOS = 'Falta aplicar la migración 0056 para las licencias de AifyOS.'

const esTablaInexistente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205')

/** Pura: qué significa una fila de aifyos_licencias. */
export function evaluarLicencia(fila) {
  if (fila?.acceso_cortesia) return { activa: true, motivo: 'cortesia' }
  if (fila && ESTADOS_SUSCRIPCION_VIVA.includes(fila.subscription_status)) return { activa: true, motivo: 'suscripcion' }
  return { activa: false, motivo: null }
}

// El periodo viene en la suscripción o, desde la API 2025-03-31 de Stripe, en cada elemento
function finDePeriodo(subscription) {
  const segundos = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end
  return segundos ? new Date(segundos * 1000).toISOString() : null
}

const errorWeb = (estado, mensaje) => Object.assign(new Error(mensaje), { estado })

export function crearAifyos({ stripe, supabaseAdmin, priceId, webhookSecret, urlFrontend, urlTerminos = 'https://os.useaify.app/terminos' }) {
  const urlAlta = `${urlFrontend}/aifyos`

  async function leerFila(organizacionId) {
    const { data, error } = await supabaseAdmin
      .from('aifyos_licencias')
      .select('organizacion_id, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, cancel_at_period_end, acceso_cortesia')
      .eq('organizacion_id', organizacionId)
      .maybeSingle()
    if (esTablaInexistente(error)) throw errorWeb(503, MENSAJE_SIN_MIGRACION_AIFYOS)
    if (error) {
      console.error('[aifyos] error leyendo la licencia:', error.message)
      throw errorWeb(500, 'No se pudo leer la licencia. Inténtalo de nuevo.')
    }
    return data || null
  }

  async function guardar(organizacionId, cambios) {
    const { error } = await supabaseAdmin
      .from('aifyos_licencias')
      .upsert({ organizacion_id: organizacionId, ...cambios, actualizado_en: new Date().toISOString() }, { onConflict: 'organizacion_id' })
    if (esTablaInexistente(error)) throw errorWeb(503, MENSAJE_SIN_MIGRACION_AIFYOS)
    if (error) throw new Error(error.message)
  }

  async function estado(organizacionId) {
    const fila = await leerFila(organizacionId)
    return {
      ...evaluarLicencia(fila),
      subscription_status: fila?.subscription_status ?? null,
      current_period_end: fila?.current_period_end ?? null,
      cancel_at_period_end: Boolean(fila?.cancel_at_period_end),
      url_alta: urlAlta,
    }
  }

  // Refleja una suscripción de Stripe en la fila de su organización. Se ignora
  // cualquier suscripción de otro precio: esta cuenta de Stripe puede tener otras.
  async function sincronizar(subscription) {
    const precio = subscription.items?.data?.[0]?.price?.id
    if (!priceId || precio !== priceId) return false
    const organizacionId = subscription.metadata?.organizacion_id
    if (!organizacionId) {
      console.error('[aifyos webhook] suscripción sin organizacion_id:', subscription.id)
      return false
    }
    await guardar(organizacionId, {
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      current_period_end: finDePeriodo(subscription),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    })
    return true
  }

  // express.raw: la firma de Stripe se calcula sobre el cuerpo exacto
  async function webhook(req, res) {
    if (!stripe || !webhookSecret || !supabaseAdmin) return res.status(503).end()
    let evento
    try {
      evento = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret)
    } catch (err) {
      console.error('[aifyos webhook] firma inválida:', err.message)
      return res.status(400).send('Firma no válida')
    }
    try {
      switch (evento.type) {
        case 'checkout.session.completed': {
          const sesion = evento.data.object
          if (sesion.mode === 'subscription' && sesion.subscription) {
            await sincronizar(await stripe.subscriptions.retrieve(sesion.subscription))
          }
          break
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          // Se relee en Stripe: los eventos pueden llegar desordenados
          await sincronizar(await stripe.subscriptions.retrieve(evento.data.object.id))
          break
        default:
          break
      }
    } catch (err) {
      // 500: Stripe reintenta. Mejor eso que un cobro sin licencia.
      console.error('[aifyos webhook] error con', evento.type, ':', err.message)
      return res.status(500).end()
    }
    res.json({ received: true })
  }

  async function crearCheckout({ organizacionId, email }) {
    if (!stripe || !priceId) throw errorWeb(503, 'El pago de AifyOS aún no está activado.')
    const fila = await leerFila(organizacionId)
    if (evaluarLicencia(fila).activa) throw errorWeb(409, 'Tu organización ya tiene AifyOS activo.')

    let cliente = fila?.stripe_customer_id
    if (!cliente) {
      const creado = await stripe.customers.create({ email, metadata: { organizacion_id: organizacionId } })
      cliente = creado.id
      await guardar(organizacionId, { stripe_customer_id: cliente })
    }
    const sesion = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: cliente,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { organizacion_id: organizacionId } },
      allow_promotion_codes: true,
      custom_text: {
        submit: { message: `La suscripción se renueva automáticamente cada mes hasta que la canceles desde tu página de AifyOS. Términos: ${urlTerminos}` },
      },
      success_url: `${urlAlta}?pago=ok`,
      cancel_url: `${urlAlta}?pago=cancelado`,
    })
    return { url: sesion.url }
  }

  async function crearPortal(organizacionId) {
    if (!stripe) throw errorWeb(503, 'El pago de AifyOS aún no está activado.')
    const fila = await leerFila(organizacionId)
    if (!fila?.stripe_customer_id) throw errorWeb(400, 'Todavía no tienes una suscripción de AifyOS.')
    const portal = await stripe.billingPortal.sessions.create({ customer: fila.stripe_customer_id, return_url: urlAlta })
    return { url: portal.url }
  }

  return { estado, sincronizar, webhook, crearCheckout, crearPortal, urlAlta }
}
