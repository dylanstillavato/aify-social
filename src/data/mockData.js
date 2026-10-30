export const clientes = [
  {
    id: 1,
    nombre: "La Buena Mesa",
    sector: "Restauración",
    descripcion: "Restaurante temático años 50 con estética retro americana. Especialidades en cocina americana clásica, hamburguesas artesanales y milkshakes. Ambiente retro y colorido en el centro de Madrid, Gran Vía 42.",
    diferencial: "Únicos en Madrid con pan artesanal horneado cada mañana, carne 100% nacional sin rellenos y salsas caseras. El local más instagrameable de Gran Vía con decoración auténtica de los años 50.",
    tono: "Cercano y divertido",
    tonoId: "cercano_divertido",
    vozPropia: "Siempre tuteo, muchos emojis en el copy, llamamos a nuestros clientes 'familia de la casa'. Referencias constantes al universo retro y americano. Humor suave y cercano.",
    prohibido: "No comparar con competidores, no publicar precios en redes, no política ni temas controvertidos, no imágenes de stock genéricas.",
    web: "www.labuenamesa.es",
    ubicacion: "Madrid, España",
    redes: ["instagram", "tiktok", "googlemaps", "whatsapp"],
    frecuencia: { instagram: 5, tiktok: 3, googlemaps: 2, whatsapp: 2 },
    redesDetalladas: {
      instagram: { activa: true, frecuencia: '3x_semana', objetivo: 'engagement' },
      tiktok: { activa: true, frecuencia: '2x_semana', objetivo: 'alcance' },
      facebook: { activa: false, frecuencia: '1x_semana', objetivo: 'branding' },
      youtube: { activa: false, frecuencia: '1x_semana', objetivo: 'alcance' },
      googlemaps: { activa: true, frecuencia: '1x_semana', objetivo: 'ventas' },
      whatsapp: { activa: true, frecuencia: '1x_semana', objetivo: 'ventas' },
    },
    audiencia: {
      edadMin: 22,
      edadMax: 45,
      genero: "mixto",
      ubicacion: "Madrid, España",
      descripcion: "Parejas y grupos de amigos de 22-40 años, residentes en Madrid o turistas, que buscan experiencias gastronómicas únicas e instagrameables. Amantes de la estética retro, la cultura americana y los planes originales de fin de semana.",
      valores: ["estetica", "experiencias", "calidad", "proximidad"],
    },
    contenidoBueno: "Fotos de hamburguesas con queso derretido, vídeos del proceso de preparación de milkshakes, stories mostrando el ambiente del local",
    contenidoMalo: "Precios en publicaciones, comparaciones con competencia, contenido político",
    historial: {
      queHaFuncionado: "Los Reels de proceso de elaboración de hamburguesas, las fotos del atardecer desde la barra, los retos de comer la Triple Burger en tiempo récord y las historias de 'Familia del mes'.",
      mejorPost: "El vídeo del reto 'Triple Burger en 10 minutos' llegó a 80k reproducciones en TikTok y 45k en Instagram. La foto del milkshake de temporada fue el post más guardado del año.",
      hashtagsPropio: "#LaBuenaMesa #FamiliaBuenaMesa #BurgerDeLaCasa",
      referencias: "El estilo de comunicación de @goiko, la creatividad de @lagranjadesan_ildefonso, el humor de @fiveguys_es",
    },
    fechasClave: "San Valentín (menú especial), Halloween (decoración temática), Navidad, American Day (4 julio), Aniversario del local (julio)",
    fechasClaveObj: {
      generales: ["san_valentin", "halloween", "navidad", "black_friday", "verano"],
      propias: [
        { id: 1, nombre: "Aniversario del local", fecha: "2026-07-15", descripcion: "4 años de La Buena Mesa. Evento especial con música en directo y carta conmemorativa." },
        { id: 2, nombre: "American Day", fecha: "2026-07-04", descripcion: "Día americano con menú especial, decoración temática y descuentos." },
      ],
      temporada: "Alta en verano (junio-septiembre) y Navidad. Baja en enero y febrero.",
    },
    competidores: [
      { nombre: "Big Belly Burgers", red: "Instagram" },
      { nombre: "Shake & Go", red: "TikTok" }
    ],
    avatar: "L",
    color: "#FF2D55",
    ultimaActividad: "Hace 2 horas",
    postsEsteMes: 18,
    creadoEn: "2026-01-15T10:00:00Z",
  },
  {
    id: 2,
    nombre: "Studio Lumière",
    sector: "Moda",
    descripcion: "Estudio de fotografía de moda y marca personal para emprendedoras. Especializado en shootings para Instagram, lookbooks y contenido para e-commerce de moda sostenible.",
    tono: "Inspiracional",
    web: "www.studiolumiere.es",
    redes: ["instagram", "tiktok"],
    frecuencia: { instagram: 7, tiktok: 4 },
    audiencia: {
      edadMin: 25,
      edadMax: 40,
      genero: "Mujer",
      ubicacion: "Barcelona, España",
      descripcion: "Emprendedoras, creadoras de contenido y marcas de moda sostenible que necesitan contenido visual de calidad premium para diferenciarse."
    },
    contenidoBueno: "Behind the scenes de shootings, transformaciones antes/después, testimonios de clientes, tutoriales de posing",
    contenidoMalo: "Contenido de competencia directa, precios sin contexto, fotos de baja calidad",
    fechasClave: "Fashion Week, vuelta al cole (septiembre), temporada de comuniones, Black Friday",
    competidores: [
      { nombre: "Flash Studio Barcelona", red: "Instagram" }
    ],
    avatar: "S",
    color: "#3D9BFF",
    ultimaActividad: "Ayer",
    postsEsteMes: 22
  },
  {
    id: 3,
    nombre: "FitZone Málaga",
    sector: "Fitness",
    descripcion: "Gimnasio boutique en Málaga con clases de HIIT, yoga y entrenamiento funcional. Ambiente motivador, entrenadores certificados y tecnología de última generación.",
    tono: "Motivacional",
    web: "www.fitzonemalaga.com",
    redes: ["instagram", "youtube"],
    frecuencia: { instagram: 6, youtube: 1 },
    audiencia: {
      edadMin: 20,
      edadMax: 45,
      genero: "Mixto",
      ubicacion: "Málaga, España",
      descripcion: "Personas activas de Málaga que buscan mejorar su condición física con métodos modernos y una comunidad de apoyo. Nivel intermedio-avanzado."
    },
    contenidoBueno: "Transformaciones de miembros, workouts del día, tips de nutrición, challenges de fitness",
    contenidoMalo: "Contenido que pueda herir sensibilidades sobre imagen corporal, promesas milagrosas",
    fechasClave: "Enero (operación bikini), verano, vuelta septiembre, maratón de Málaga",
    competidores: [
      { nombre: "CrossFit Málaga", red: "Instagram" },
      { nombre: "BodyPump Gym", red: "YouTube" }
    ],
    avatar: "F",
    color: "#30D158",
    ultimaActividad: "Hace 3 días",
    postsEsteMes: 7
  }
];

export const calendarioEjemplo = {
  cliente: "La Buena Mesa",
  mes: "Mayo 2026",
  posts: [
    {
      id: 1,
      dia: 1,
      red: "instagram",
      tipo: "Reel",
      titulo: "Proceso del burger perfecto",
      copy: "✨ ¿Sabes cuánto amor hay detrás de nuestra burger de la casa?\n\nDesde el pan artesanal horneado cada mañana hasta la carne 100% nacional... cada detalle cuenta 🍔\n\n¿Cuál es tu ingrediente favorito? Cuéntanoslo en comentarios 👇\n\n#LaBuenaMesa #BurgerMadrid #ComidasAmericanas #RestauranteMadrid #Foodie #EstiloRetro",
      hashtags: "#LaBuenaMesa #BurgerMadrid #Foodie #RestauranteMadrid",
      hora: "19:00",
      hooks: "El secreto de nuestra burger que nadie te había contado..."
    },
    {
      id: 2,
      dia: 2,
      red: "tiktok",
      tipo: "TikTok",
      titulo: "Milkshake en cámara lenta",
      copy: "POV: Llegas a La Buena Mesa y ves cómo preparamos nuestro Milkshake de Oreo 🥤✨\n\n¿Te quedas con el sabor clásico o el de temporada? 👇\n\n@labuenamesa #Milkshake #FoodTok #RestauranteMadrid #ASMR",
      hashtags: "#FoodTok #Milkshake #MadridFood #ASMR",
      hora: "18:00",
      hooks: "POV: Tu primera vez en La Buena Mesa..."
    },
    {
      id: 3,
      dia: 5,
      red: "instagram",
      tipo: "Post",
      titulo: "Nuevo menú de temporada",
      copy: "🌸 ¡PRIMAVERA EN LA BUENA MESA! 🌸\n\nEste mayo te traemos nuestra carta de temporada con sabores que te van a enamorar:\n\n🍓 Burger Strawberry Crunch\n🌿 Milkshake de Matcha & Oreo\n🍋 Limonada Especial de la Casa\n\nReserva tu mesa ahora y sé de los primeros en probarlos 👉 Link en bio\n\n#MenuTemporada #NuevaCarta #LaBuenaMesa #Primavera2026",
      hashtags: "#MenuTemporada #LaBuenaMesa #NuevaCarta #Madrid",
      hora: "12:00",
      hooks: "Nueva carta de primavera ya disponible"
    },
    {
      id: 4,
      dia: 7,
      red: "googlemaps",
      tipo: "Post Google",
      titulo: "Actualización Google Maps",
      copy: "¡Visítanos este fin de semana! 🎉\n\nEn La Buena Mesa encontrarás las mejores hamburguesas artesanales de Madrid, milkshakes de ensueño y un ambiente años 50 que te transportará a otra época.\n\n✅ Abierto todos los días de 13:00 a 24:00\n✅ Reservas disponibles online\n✅ Menú para niños disponible\n\nSomos el plan perfecto para una cena diferente en Madrid Centro.",
      hashtags: "",
      hora: "10:00",
      hooks: "El restaurante años 50 más instagrameable de Madrid"
    },
    {
      id: 5,
      dia: 8,
      red: "whatsapp",
      tipo: "Mensaje Canal",
      titulo: "Oferta fin de semana",
      copy: "🍔 ¡OFERTA EXCLUSIVA CANAL! 🍔\n\nEste sábado y domingo: 2x1 en todos nuestros milkshakes cuando pidas con cualquier burger principal.\n\nSolo para suscriptores de nuestro canal 💜\n\nReservas: wa.me/34600000000\nO visítanos directamente en Calle Gran Vía 42, Madrid\n\n¡Te esperamos! 🌟",
      hashtags: "",
      hora: "11:00",
      hooks: "Oferta exclusiva solo para ti 🎁"
    },
    {
      id: 6,
      dia: 12,
      red: "instagram",
      tipo: "Story",
      titulo: "Poll: ¿qué burger prefieres?",
      copy: "¿ENCUESTA DEL LUNES? 🍔\n\nVota en nuestra Story:\n🔴 Clásica de la Casa\n🔵 BBQ Smokehouse\n\nLa ganadora de la semana tendrá descuento especial el viernes 👀\n\n#LaBuenaMesa #PollTime",
      hashtags: "#Poll #LaBuenaMesa #BurgerLovers",
      hora: "13:00",
      hooks: "Solo una puede ganar... ¿por cuál votas?"
    },
    {
      id: 7,
      dia: 14,
      red: "tiktok",
      tipo: "TikTok",
      titulo: "Day in the life restaurante",
      copy: "Un día en La Buena Mesa desde las 7 AM hasta el cierre 🍳👩‍🍳\n\nDe la preparación a la hora punta del almuerzo... ¿sabías que preparamos el pan cada mañana? 🥖\n\nSigue nuestra cuenta para más behind the scenes 💜\n\n#DayInTheLife #Restaurante #BehindTheScenes #FoodTok #Madrid",
      hashtags: "#DayInTheLife #BehindTheScenes #RestauranteMadrid",
      hora: "20:00",
      hooks: "Lo que no ves cuando pides tu burger favorita..."
    },
    {
      id: 8,
      dia: 15,
      red: "instagram",
      tipo: "Carrusel",
      titulo: "5 razones para visitarnos",
      copy: "5 razones por las que La Buena Mesa tiene que estar en tu lista de Madrid 📍✨\n\n1️⃣ Hamburguesas 100% carne nacional artesanal\n2️⃣ Ambiente años 50 único en Madrid\n3️⃣ Milkshakes que no encontrarás en otro sitio\n4️⃣ El spot más instagrameable de Gran Vía\n5️⃣ Experiencia completa: comida + ambiente + servicio\n\nGuarda este post para tu próxima visita a Madrid 🗺️\n\n#Madrid #GuíaMadrid #RestauranteMadrid #TurismoMadrid",
      hashtags: "#Madrid #GuíaMadrid #RestauranteMadrid #Instagrameable",
      hora: "11:00",
      hooks: "Por qué todo el mundo habla de este restaurante de Madrid"
    },
    {
      id: 9,
      dia: 19,
      red: "googlemaps",
      tipo: "Post Google",
      titulo: "Celebraciones y grupos",
      copy: "¿Buscas el lugar perfecto para celebraciones en Madrid? 🎉\n\nEn La Buena Mesa organizamos:\n• Cumpleaños temáticos\n• Despedidas de soltera temáticas\n• Cenas de empresa únicas\n• Reservas de grupos hasta 30 personas\n\nContacta con nosotros y diseñamos tu evento personalizado. ¡La experiencia más memorable de Madrid te espera!",
      hashtags: "",
      hora: "09:00",
      hooks: "El lugar más especial para celebrar en Madrid"
    },
    {
      id: 10,
      dia: 21,
      red: "instagram",
      tipo: "Reel",
      titulo: "Reto viral: burger challenge",
      copy: "🔥 ¿ACEPTAS EL RETO? 🔥\n\nNuestro Burger Challenge: come la Triple Burger de la Casa en menos de 5 minutos y... ¡la siguiente es gratis!\n\nEtiqueta a quien crees que puede lograrlo 👇👇\n\n¿Te atreves? Reserva en el link de bio\n\n#BurgerChallenge #LaBuenaMesa #Reto #FoodChallenge #Madrid",
      hashtags: "#BurgerChallenge #FoodChallenge #Madrid #Reto",
      hora: "19:30",
      hooks: "Nadie ha podido acabarla... ¿serás tú el primero?"
    },
    {
      id: 11,
      dia: 22,
      red: "whatsapp",
      tipo: "Mensaje Canal",
      titulo: "Novedad menú",
      copy: "🆕 ¡NOVEDAD EXCLUSIVA ANTES QUE NADIE! 🆕\n\nDesde esta semana en carta:\n🍔 DOUBLE SMOKEHOUSE CLÁSICA\nDoble carne, bacon ahumado, cheddar madurado y nuestra salsa secreta BBQ de la Casa\n\nPrecio lanzamiento: 14,90€ (precio habitual: 17,50€)\n\nOferta válida solo esta semana. ¡Ven a probarla! 🔥",
      hashtags: "",
      hora: "10:00",
      hooks: "Solo tú lo sabes antes de que se publique..."
    },
    {
      id: 12,
      dia: 26,
      red: "instagram",
      tipo: "Post",
      titulo: "Reseña de cliente destacada",
      copy: "💬 Cuando nuestros clientes nos escriben esto, sabemos que lo estamos haciendo bien 💜\n\n\"La mejor hamburguesería de Madrid sin duda. El ambiente es precioso, la comida espectacular y el servicio 10/10. Venimos desde Vallecas y merece cada kilómetro\" — María R. ⭐⭐⭐⭐⭐\n\n¿Ya has tenido tu experiencia La Buena Mesa? Cuéntanosla en comentarios o en Google 👇\n\n#Reseña #ClientesFelices #LaBuenaMesa #MejorHamburguesaMadrid",
      hashtags: "#Reseña #ClientesFelices #MejorBurger #Madrid",
      hora: "18:00",
      hooks: "Lo que dicen nuestros clientes nos emociona cada vez"
    },
    {
      id: 13,
      dia: 28,
      red: "tiktok",
      tipo: "TikTok",
      titulo: "Tendencia sonido trending",
      copy: "Cuando la gente pregunta dónde comer en Madrid y tú sabes exactamente la respuesta 📍🍔\n\nLa Buena Mesa, Gran Vía 42 💜\n\n¿Ya nos has visitado? Comenta 🍔 si eres cliente o ❓ si tienes que venir ya\n\n#Madrid #ComerEnMadrid #FoodTok #Recomendación",
      hashtags: "#Madrid #ComerEnMadrid #FoodTok #ViralFood",
      hora: "17:00",
      hooks: "La respuesta que todos deberían dar cuando preguntan por Madrid"
    },
    {
      id: 14,
      dia: 30,
      red: "instagram",
      tipo: "Reel",
      titulo: "Cierre de mes especial",
      copy: "🌟 MAYO EN LA BUENA MESA 🌟\n\nGracias a todos los que habéis pasado por aquí este mes. Habéis sido increíbles 💜\n\nResumen del mes:\n📸 4.200 visitas\n🍔 +800 burgers servidas\n🥛 +400 milkshakes\n⭐ Nota media Google: 4.9\n\nJunio viene con sorpresas... ¡Estate atento/a! 👀\n\n#GraciasClientes #LaBuenaMesa #Comunidad #Madrid",
      hashtags: "#GraciasClientes #Comunidad #LaBuenaMesa #Mayo",
      hora: "20:00",
      hooks: "Lo que pasó en La Buena Mesa este mayo..."
    }
  ]
};

export const copiesEjemplo = {
  instagram_reel: [
    {
      id: 1,
      variante: "Variante A — Emocional",
      copy: "✨ Lo que más nos gusta de nuestro trabajo no es la comida...\n\nEs ver cómo la gente entra con cara de cansancio y sale con una sonrisa de oreja a oreja 😊\n\nEsa es la magia de La Buena Mesa.\n\n¿Cuándo fue la última vez que te diste un capricho de verdad? 👇\n\n#LaBuenaMesa #ExperienciaGastronómica #Madrid #Restaurante",
      engagement: "Alto",
      longitud: "Corto"
    },
    {
      id: 2,
      variante: "Variante B — Urgencia",
      copy: "⚠️ AVISO IMPORTANTE: Nuestras mesas del viernes se están agotando.\n\nSi querías venir este finde... mejor que reserves YA.\n\nLink en bio o escríbenos directamente.\n\n¿Nos vemos el viernes? 🍔\n\n#LaBuenaMesa #ReservaYa #Madrid #Finde",
      engagement: "Medio-alto",
      longitud: "Corto"
    },
    {
      id: 3,
      variante: "Variante C — Storytelling",
      copy: "Hace 3 años, María pensó que abrir un restaurante temático en Madrid era una locura.\n\nTodo el mundo le decía que no.\n\nHoy La Buena Mesa tiene más de 2.000 reseñas con una nota de 4.9 ⭐\n\nA veces las locuras más grandes son las mejores decisiones.\n\nGracias por ser parte de esta historia 💜\n\n#LaBuenaMesa #Historia #Restaurante #Madrid #Emprendimiento",
      engagement: "Muy alto",
      longitud: "Medio"
    }
  ],
  tiktok: [
    {
      id: 1,
      variante: "Variante A — Hook fuerte",
      copy: "Mentira que los restaurantes de Madrid son todos iguales 😅\n\nEste lugar cambió mi perspectiva completamente. \n\nAmbiente años 50, hamburguesas que no como en mi vida, milkshakes de película...\n\n¿Lo conocías? Comenta 👇\n\n@labuenamesa #Madrid #Restaurante #FoodTok #Sorpresa",
      engagement: "Muy alto",
      longitud: "Corto"
    },
    {
      id: 2,
      variante: "Variante B — Educativo",
      copy: "3 señales de que una hamburguesería es buena de verdad:\n\n1️⃣ Hacen el pan ellos mismos\n2️⃣ La carne no tiene rellenos\n3️⃣ Las salsas son caseras\n\nEn La Buena Mesa cumplimos las 3. ¿Coincides con esta lista? 🍔\n\n#BurgerTips #FoodTok #Madrid #Hamburguesería",
      engagement: "Alto",
      longitud: "Corto"
    },
    {
      id: 3,
      variante: "Variante C — Trending sound",
      copy: "Me: \"hoy como sano\"\n\nTambién yo viendo el menú de La Buena Mesa:\n\n🍔🍔🍔\n\nNo me arrepiento de nada.\n\n@labuenamesa #LaBuenaMesa #ComerSano #Madrid #FoodTok #Viral",
      engagement: "Viral",
      longitud: "Muy corto"
    }
  ]
};

export const guionesEjemplo = [
  {
    id: 1,
    titulo: "El secreto del pan artesanal",
    duracion: "45-60 segundos",
    gancho: "\"Lo que nunca te muestran los restaurantes de Madrid... nosotros sí\"",
    desarrollo: [
      { escena: 1, descripcion: "Plano detalle: manos amasan la masa a las 7 AM", duracion: "3s", texto: "7 de la mañana" },
      { escena: 2, descripcion: "Time-lapse: pan en el horno, dorandose", duracion: "5s", texto: "El pan que comes hoy se hizo esta mañana" },
      { escena: 3, descripcion: "Close-up: pan recién horneado, vapor saliendo", duracion: "4s", texto: "0 conservantes. 0 congelados." },
      { escena: 4, descripcion: "Montaje rápido: preparación hamburguesa completa", duracion: "8s", texto: "Esto es lo que comes cuando pides en La Buena Mesa" },
      { escena: 5, descripcion: "Reacción del cliente al primer mordisco", duracion: "5s", texto: "¿Entiendes ahora por qué saben diferente?" }
    ],
    textoEnPantalla: ["7 AM", "Pan hecho hoy", "Sin conservantes", "Así se hace", "¿Notas la diferencia?"],
    audioSugerido: "Trending: sonido de cocina ASMR + música lo-fi chill",
    cta: "Reserva en el link de bio. Sé de los primeros del día en probarlo 🍞"
  },
  {
    id: 2,
    titulo: "Milkshake ASMR challenge",
    duracion: "30-45 segundos",
    gancho: "\"POV: Pides el milkshake más fotogénico de Madrid\"",
    desarrollo: [
      { escena: 1, descripcion: "Manos del bartender preparando el vaso", duracion: "3s", texto: "POV: tu pedido" },
      { escena: 2, descripcion: "Slow motion: helado cayendo en el vaso", duracion: "5s", texto: "Helado artesanal" },
      { escena: 3, descripcion: "Oreos trituradas cayendo en cámara lenta", duracion: "4s", texto: "Oreos de verdad" },
      { escena: 4, descripcion: "Batido final, nata montada, decoración", duracion: "5s", texto: "El resultado..." },
      { escena: 5, descripcion: "Cliente con ojos abiertos de sorpresa", duracion: "3s", texto: "Cada. Vez." }
    ],
    textoEnPantalla: ["Tu pedido 👀", "Helado artesanal 🍦", "Oreos reales 🍪", "Mira esto...", "¿Cómo no venir? 🤍"],
    audioSugerido: "Trending ASMR: sonidos de batidora, cristal, nata montada",
    cta: "¿Cuál pides? Vanilla Dream o Oreo Madness? Comenta 👇"
  }
];

export const statsDemo = {
  clientesActivos: 3,
  postsGenerados: 47,
  horasAhorradas: 12,
  calendariosCompletados: 2
};
