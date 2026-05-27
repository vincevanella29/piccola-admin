/**
 * API Service for Garzón Virtual
 * Handles requests to the backend (via Vite proxy `/api`) and provides
 * robust mock fallback data if the backend is unreachable or unauthorized.
 */

// Local fallback data to guarantee standalone functionality
const FALLBACK_MENUS = {
  categories: [
    { id: "cat_pizzas", name: "Pizzas 🍕", menu_ids: ["p1", "p2", "p3", "p4"] },
    { id: "cat_pastas", name: "Pastas 🍝", menu_ids: ["pa1", "pa2", "pa3"] },
    { id: "cat_bebidas", name: "Bebidas 🍷", menu_ids: ["b1", "b2", "b3"] },
    { id: "cat_postres", name: "Postres 🍰", menu_ids: ["po1", "po2"] }
  ],
  menus: [
    // Pizzas
    {
      id: "p1",
      nombre: "Pizza Margherita",
      precio: 8900,
      descripcion: "Salsa de tomate casera, mozzarella premium, albahaca fresca y aceite de oliva virgen extra.",
      categoria_id: "cat_pizzas",
      codigo: "PIZ_MAR",
      imagen_url: ""
    },
    {
      id: "p2",
      nombre: "Pizza Pepperoni",
      precio: 9900,
      descripcion: "Salsa de tomate, queso mozzarella abundante y doble porción de pepperoni artesanal curado.",
      categoria_id: "cat_pizzas",
      codigo: "PIZ_PEP",
      imagen_url: ""
    },
    {
      id: "p3",
      nombre: "Pizza Quattro Formaggi",
      precio: 10900,
      descripcion: "Exquisita combinación de queso mozzarella, gorgonzola, parmesano y provolone.",
      categoria_id: "cat_pizzas",
      codigo: "PIZ_FOR",
      imagen_url: ""
    },
    {
      id: "p4",
      nombre: "Pizza La Nonna",
      precio: 11500,
      descripcion: "Nuestra especialidad: jamón serrano, rúcula fresca, láminas de parmesano y reducción de balsámico.",
      categoria_id: "cat_pizzas",
      codigo: "PIZ_NON",
      imagen_url: ""
    },
    // Pastas
    {
      id: "pa1",
      nombre: "Fettuccine Alfredo con Pollo",
      precio: 9500,
      descripcion: "Pasta fresca artesanal salteada en salsa de crema de leche de primera calidad, parmesano y tiernas tiras de pollo a la plancha.",
      categoria_id: "cat_pastas",
      codigo: "PAS_ALF",
      imagen_url: ""
    },
    {
      id: "pa2",
      nombre: "Lasagna Boloñesa",
      precio: 10200,
      descripcion: "Capas alternadas de pasta al huevo, salsa ragú de carne cocinada a fuego lento, bechamel cremosa y gratinado crujiente de mozzarella.",
      categoria_id: "cat_pastas",
      codigo: "PAS_LAS",
      imagen_url: ""
    },
    {
      id: "pa3",
      nombre: "Gnocchi al Pesto Genovese",
      precio: 8900,
      descripcion: "Ñoquis de papa hechos a mano con salsa tradicional de albahaca fresca, piñones, parmesano y aceite de oliva.",
      categoria_id: "cat_pastas",
      codigo: "PAS_GNO",
      imagen_url: ""
    },
    // Bebidas
    {
      id: "b1",
      nombre: "Pisco Sour La Piccola",
      precio: 4500,
      descripcion: "Pisco chileno premium, jugo fresco de limón de pica, jarabe de goma casero y clara de huevo.",
      categoria_id: "cat_bebidas",
      codigo: "BEB_SOUR",
      imagen_url: ""
    },
    {
      id: "b2",
      nombre: "Copa de Vino Reserva Tinto/Blanco",
      precio: 3800,
      descripcion: "Vino de cepa seleccionada de la casa. Perfecto maridaje para pastas y carnes rojas.",
      categoria_id: "cat_bebidas",
      codigo: "BEB_VINO",
      imagen_url: ""
    },
    {
      id: "b3",
      nombre: "Bebida Express (Lata)",
      precio: 2200,
      descripcion: "Variedad de bebidas gaseosas (Coca-Cola, Sprite, Fanta) heladas.",
      categoria_id: "cat_bebidas",
      codigo: "BEB_LATA",
      imagen_url: ""
    },
    // Postres
    {
      id: "po1",
      nombre: "Tiramisú Tradizionale",
      precio: 4200,
      descripcion: "Auténtico tiramisú italiano con bizcochos soletilla humedecidos en café expreso, licor Amaretto y crema mascarpone espolvoreada con cacao.",
      categoria_id: "cat_postres",
      codigo: "POS_TIR",
      imagen_url: ""
    },
    {
      id: "po2",
      nombre: "Panna Cotta con Frutos del Bosque",
      precio: 3900,
      descripcion: "Flan de crema de vainilla servido con salsa tibia de frambuesas, moras y arándanos frescos.",
      categoria_id: "cat_postres",
      codigo: "POS_PAN",
      imagen_url: ""
    }
  ],
  menu_options: []
};

const FALLBACK_LOCATIONS = [
  { id: "l1", name: "La Piccola Italia - Providencia", permalink_slug: "providencia", direccion: "Av. Providencia 1234, Santiago" },
  { id: "l2", name: "La Piccola Italia - Vitacura", permalink_slug: "vitacura", direccion: "Av. Vitacura 5678, Santiago" }
];

// Helper to construct complete URLs
const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.warn(`API call failed for ${endpoint}:`, error.message);
    throw error;
  }
};

export const getMenus = async () => {
  try {
    const data = await apiRequest('/api/menus');
    if (data && data.menus && data.menus.length > 0) {
      return data;
    }
    return FALLBACK_MENUS;
  } catch (err) {
    return FALLBACK_MENUS;
  }
};

export const getLocations = async () => {
  try {
    const data = await apiRequest('/api/locations');
    if (data && data.locations) {
      return data.locations;
    }
    return FALLBACK_LOCATIONS;
  } catch (err) {
    return FALLBACK_LOCATIONS;
  }
};

export const getProfile = async (faceId) => {
  try {
    return await apiRequest(`/api/profile/${faceId}`);
  } catch (err) {
    console.warn(`Could not get profile for ${faceId}:`, err.message);
    return null;
  }
};

export const saveProfile = async (profileData) => {
  try {
    return await apiRequest('/api/profile', {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
  } catch (err) {
    console.warn('Could not save profile:', err.message);
    return { ok: false };
  }
};

export const startChatSession = async () => {
  try {
    // metadata.force_new starts a fresh conversation
    const data = await apiRequest('/api/chat/session/start', {
      method: 'POST',
      body: JSON.stringify({ metadata: { force_new: true } })
    });
    return data.conv_id || Date.now();
  } catch (err) {
    // Devuelve un ID aleatorio local si falla la conexión
    return Date.now();
  }
};

export const sendChatMessage = async (convId, text, cart = [], profile = null, onboardingFaceId = null) => {
  try {
    const data = await apiRequest('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        conv_id: convId,
        text,
        cart,
        profile,
        onboarding_face_id: onboardingFaceId
      })
    });
    return data;
  } catch (err) {
    console.warn('Could not post chat message to server:', err.message);
    return null;
  }
};

/**
 * Procesa comandos de forma local (Offline fallback)
 * Esto permite interactuar con el Garzón Virtual sin depender del API.
 * 
 * @param {string} prompt - Texto dictado o ingresado
 * @param {Array} menuItems - Listado de platos del menú para buscar coincidencias
 * @returns {Promise<Object>} Respuesta estructurada
 */
export const processLocalCommand = async (prompt, menuItems, cart = [], profile = null) => {
  const text = prompt.toLowerCase().trim();

  // 0. Onboarding de rostro: Si estamos esperando el nombre de un rostro nuevo
  if (profile && profile.onboarding) {
    let name = prompt.replace(/me llamo/gi, "")
                     .replace(/mi nombre es/gi, "")
                     .replace(/soy/gi, "")
                     .replace(/hola/gi, "")
                     .replace(/buenos dias/gi, "")
                     .replace(/buenos días/gi, "")
                     .trim();
    // Capitalizar
    name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    if (name.length > 0) {
      return {
        text: `¡Mucho gusto, **${name}**! Qué lindo nombre, mio caro. La Nonna ha guardado tu rostro en la memoria de la casa. ¿Qué te gustaría comer de rico hoy, po?`,
        intent: "register_profile_success",
        registerName: name
      };
    }
  }

  // 0.1. Comando: Saludo (Hola / Buenos días)
  if (text.includes("hola") || text.includes("buenos dias") || text.includes("buenos días") || text.includes("buen día") || text.includes("buen dia")) {
    const greetingName = (profile && profile.name) ? ` ${profile.name}` : "";
    return {
      text: `¡Hola${greetingName}, cómo estái, bambino! Qué alegría tenerte en La Piccola Italia. ¿Qué les gustaría pedir de comer hoy, po?`,
      intent: "greeting"
    };
  }

  // 1. Comando: Pedir la cuenta
  if (text.includes("cuenta") || text.includes("pagar") || text.includes("boleta") || text.includes("total")) {
    const clientName = (profile && profile.name) ? `, ${profile.name}` : "";
    return {
      text: `¡Por supuesto${clientName}, mio caro! Te he preparado la cuenta aquí mismo en la pantalla. Puedes pagar con tarjeta de inmediato o, si prefieres, mi bambino del salón se acercará con la máquina Redbanc en un ratito. ¡Muchas gracias por comer con la Nonna!`,
      intent: "bill",
    };
  }

  // 2. Comando: Llamar mesero humano
  if (text.includes("llamar") || text.includes("mesero") || text.includes("garzon") || text.includes("ayuda") || text.includes("humano")) {
    return {
      text: "¡Entendido! Ya le hice una seña a uno de mis bambinos del salón. Se dirige a tu mesa volando para asistirte personalmente en unos segundos, po.",
      intent: "call_waiter",
    };
  }

  // 3. Comando: Recomendación
  if (text.includes("recomienda") || text.includes("recomiendas") || text.includes("sugerencia") || text.includes("sugieres") || text.includes("especialidad") || text.includes("rico") || text.includes("bueno")) {
    // Elegimos algunos al azar o por especialidad
    let chosen = [];
    if (text.includes("pasta")) {
      chosen = menuItems.filter(i => i.categoria_id === "cat_pastas");
    } else if (text.includes("postre") || text.includes("dulce")) {
      chosen = menuItems.filter(i => i.categoria_id === "cat_postres");
    } else if (text.includes("tomar") || text.includes("beber") || text.includes("vino") || text.includes("pisco")) {
      chosen = menuItems.filter(i => i.categoria_id === "cat_bebidas");
    } else {
      // General: La Nonna y Fettuccine
      chosen = menuItems.filter(i => i.id === "p4" || i.id === "pa1");
    }

    if (chosen.length === 0) chosen = [menuItems[0]];
    
    return {
      text: `¡Mio caro! Tienes que probar la especialidad de la casa: **${chosen[0].nombre}**. ${chosen[0].descripcion} ¡Quedó exquisito, hecho con mucho amor como le gusta a la Nonna! ¿Te lo agrego al pedido, po?`,
      intent: "recommendation",
      highlightIds: chosen.map(i => i.id)
    };
  }

  // Map de palabras clave robusto de los 22 productos reales cargados desde la DB
  const keywordsMap = {
    e1: ["bruschetta", "brusqueta", "tostadas", "tostada"],
    e2: ["carpaccio", "carpacio"],
    e3: ["calamares", "calamar", "anillos de calamar"],
    p1: ["margherita", "margarita", "pizza margherita", "pizza margarita"],
    p2: ["pepperoni", "peperoni", "pizza pepperoni", "pizza peperoni"],
    p3: ["formaggi", "quesos", "cuatro quesos", "pizza cuatro quesos", "pizza formaggi"],
    p4: ["nonna", "la nonna", "pizza la nonna"],
    p5: ["napolitana", "pizza napolitana"],
    pa1: ["fettuccine", "fettucini", "alfredo", "fettuccine alfredo"],
    pa2: ["lasagna", "lasaña", "lasagna boloñesa", "lasaña boloñesa"],
    pa3: ["gnocchi", "ñoqui", "ñoquis", "pesto", "gnocchi al pesto"],
    pa4: ["ravioles", "raviol", "ravioli", "ravioles de espinaca", "ricotta"],
    pa5: ["spaghetti", "espagueti", "carbonara", "spaghetti carbonara"],
    b1: ["pisco", "sour", "pisco sour"],
    b2: ["vino tinto", "tinto reserva", "tinto"],
    b3: ["vino blanco", "blanco reserva", "blanco"],
    b4: ["coca cola", "coca-cola", "coca", "bebida lata"],
    b5: ["aperol", "spritz", "aperol spritz"],
    po1: ["tiramisu", "tiramisú"],
    po2: ["panna cotta", "panacota", "frutos del bosque"],
    po3: ["volcan de chocolate", "volcán de chocolate", "volcan", "volcán"],
    po4: ["gelato", "helado", "helado italiano"]
  };

  // 3.5. Comando: Cancelar / Eliminar plato (Verificación previa para evitar colisión de adición)
  const cancelKeywords = ["cancelar", "eliminar", "quitar", "borrar", "saca", "sacar", "descartar", "remover"];
  const isCancellation = cancelKeywords.some(kw => text.includes(kw));

  if (isCancellation) {
    for (const item of menuItems) {
      const nameNorm = item.nombre.toLowerCase();
      const matchesKeyword = keywordsMap[item.id]?.some(kw => text.includes(kw));
      
      if (text.includes(nameNorm) || matchesKeyword || (item.codigo && text.includes(item.codigo.toLowerCase()))) {
        // Verificar si el plato está en el carrito
        const isInCart = cart.some(cartItem => cartItem.id === item.id);
        if (!isInCart) {
          return {
            text: `¡Oye po, bambino! El plato **${item.nombre}** no está en tu pedido actual. ¿Deseas ordenar algo más de mangiare o prefieres que enviemos el pedido a la cocina?`,
            intent: "remove_item_failed"
          };
        }
        return {
          text: `Entendido, mio caro. He quitado **${item.nombre}** de tu pedido. ¿Deseas algo más de mangiare o prefieres que enviemos el pedido a la cocina?`,
          intent: "remove_item",
          removeItem: item
        };
      }
    }
    
    return {
      text: "Disculpa, mio caro, no logré entender qué plato o bebida quieres sacar de la mesa. ¿Me lo podrías repetir con calma?",
      intent: "remove_item_failed"
    };
  }

  // 3.7. Comando: Pedir lo de siempre / Plato favorito
  if (
    text.includes("lo de siempre") || 
    text.includes("mi favorito") || 
    text.includes("lo mismo de la otra vez") || 
    text.includes("lo mismo de siempre") ||
    text.includes("traeme lo mismo") ||
    text.includes("tráeme lo mismo")
  ) {
    if (profile && profile.favorite_item_id) {
      const favItem = menuItems.find(i => i.id === profile.favorite_item_id);
      if (favItem) {
        return {
          text: `¡Al tiro, bambino! Te he agregado tu favorito de siempre: **${favItem.nombre}** al pedido. ¿Deseas algo más o prefieres que lo enviemos a la cocina?`,
          intent: "add_item",
          addItem: favItem
        };
      }
    }
    return {
      text: "Aún no tengo registrado tu plato favorito en mi memoria, bambina. Pídeme algo rico hoy para que me lo aprenda y te lo traiga la próxima vez, po.",
      intent: "add_favorite_failed"
    };
  }

  // 3.6. Comando: Enviar pedido a la cocina
  if (
    text.includes("enviar a la cocina") || 
    text.includes("enviar pedido a la cocina") || 
    text.includes("mandar a la cocina") || 
    text.includes("mandar pedido a la cocina") || 
    text.includes("enviar pedido") || 
    text.includes("mandar pedido") || 
    text.includes("confirmar pedido") ||
    text.includes("enviar a cocina") ||
    text.includes("mandar a cocina") ||
    text.includes("enviar el pedido") ||
    text.includes("mandar el pedido") ||
    text === "enviar" ||
    text === "confirmar" ||
    text === "mandar" ||
    (text.includes("cocina") && (text.includes("enviar") || text.includes("mandar") || text.includes("si") || text.includes("sí") || text.includes("confirmar") || text.includes("mandala") || text.includes("mándala") || text.includes("envialo") || text.includes("envíalo")))
  ) {
    return {
      text: "¡Excelente, bambino! Acabo de mandar tu pedido volando a la cocina. ¡Se comenzará a preparar de inmediato para que coman calientito y delicioso!",
      intent: "send_to_kitchen"
    };
  }

  // 4. Comando: Agregar un plato directamente
  for (const item of menuItems) {
    const nameNorm = item.nombre.toLowerCase();
    const matchesKeyword = keywordsMap[item.id]?.some(kw => text.includes(kw));
    
    if (text.includes(nameNorm) || matchesKeyword || (item.codigo && text.includes(item.codigo.toLowerCase()))) {
      return {
        text: `¡Qué delicia, mio caro! He agregado **${item.nombre}** a tu pedido. ¿Deseas algo más de mangiare o prefieres que enviemos el pedido a la cocina?`,
        intent: "add_item",
        addItem: item
      };
    }
  }

  // Fallback conversacional general estilo La Nonna
  const generalResponses = [
    "¡Hola, bambinos! Soy la Nonna Marriana. Estoy aquí para tomar tu pedido o recomendarte un vino bien rico. ¿Qué se te antoja mangiare hoy?",
    "Me encanta conversar contigo, mio caro. ¿Te gustaría que te recomiende un vinito reserva de la casa para acompañar la cena?",
    "Perfecto, po. Recuerda que puedes pedirme cosas como 'tráeme una lasagna', 'recomiéndame una pasta' o 'tráeme la cuenta' a viva voz.",
    "Entendido, mio caro. La Nonna está atenta a lo que necesites para que disfrutes de la mejor experiencia italiana en Santiago."
  ];
  
  const randIdx = Math.floor(Math.random() * generalResponses.length);
  return {
    text: generalResponses[randIdx],
    intent: "chat"
  };
};
