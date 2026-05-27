import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Receipt, 
  Mic, 
  MicOff, 
  Trash2, 
  ShoppingBag, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  MessageSquare,
  Sparkles,
  UserCheck,
  ChefHat,
  CheckCircle
} from 'lucide-react';
import Avatar from './components/Avatar';
import MenuCatalog from './components/MenuCatalog';
import FaceScanner from './components/FaceScanner';
import { 
  getMenus, 
  getLocations, 
  startChatSession, 
  sendChatMessage, 
  processLocalCommand,
  getProfile,
  saveProfile
} from './services/api';

export default function App() {
  // --- Estados de Negocio y Datos ---
  const [categories, setCategories] = useState([]);
  const [menus, setMenus] = useState([]);
  const [cart, setCart] = useState([]);
  const [highlightedIds, setHighlightedIds] = useState([]);
  const [tableNumber] = useState(14); // Mesa fija simulada en la tablet

  // --- Estados de Interacción y Chat ---
  const [convId, setConvId] = useState(null);
  const [status, setStatus] = useState('ready'); // 'ready' | 'listening' | 'thinking' | 'speaking'
  const [userText, setUserText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [botResponse, setBotResponse] = useState('¡Hola! Soy tu Garzón Virtual. Presiona "Activar Garzón Virtual" para encender la cámara y el micrófono, y pídeme lo que quieras a viva voz (ej: "Tráeme un Tiramisú", "Recomiéndame una pasta").');

  // --- Estados de Modales y Ajustes ---
  const [alertWaiterActive, setAlertWaiterActive] = useState(false);
  const [orderSentActive, setOrderSentActive] = useState(false);
  const [activeProfile, setActiveProfile] = useState(null);
  const [detectedFaceId, setDetectedFaceId] = useState(null);
  const [onboardingFaceId, setOnboardingFaceId] = useState(null);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  
  // Refs para evitar stale closures
  const activeProfileRef = useRef(null);
  const onboardingFaceIdRef = useRef(null);
  const waitingForConfirmationRef = useRef(false);

  useEffect(() => {
    waitingForConfirmationRef.current = waitingForConfirmation;
  }, [waitingForConfirmation]);

  useEffect(() => {
    activeProfileRef.current = activeProfile;
  }, [activeProfile]);

  useEffect(() => {
    onboardingFaceIdRef.current = onboardingFaceId;
  }, [onboardingFaceId]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showManualInput, setShowManualInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [isInsecureContext, setIsInsecureContext] = useState(false);
  const [isSensorActive, setIsSensorActive] = useState(false);
  
  const isSensorActiveRef = useRef(false);
  const statusRef = useRef(status);
  const hasGreetedForFaceRef = useRef(false);

  // Refs de estado para evitar stale closures en Speech Recognition
  const menusRef = useRef(menus);
  const convIdRef = useRef(convId);
  const voiceEnabledRef = useRef(voiceEnabled);
  const cartRef = useRef(cart);

  // Sincronizar cartRef con el carrito
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Sincronizar statusRef con el estado status
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Sincronizar refs con los estados correspondientes
  useEffect(() => {
    menusRef.current = menus;
  }, [menus]);

  useEffect(() => {
    convIdRef.current = convId;
  }, [convId]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // --- Verificar contexto seguro (Cámara/Micrófono) ---
  useEffect(() => {
    if (window.isSecureContext === false) {
      setIsInsecureContext(true);
    }
  }, []);

  // --- Refs para Voz ---
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);

  // --- Carga Inicial de Datos ---
  useEffect(() => {
    async function loadData() {
      // 1. Obtener menú
      const menuData = await getMenus();
      setCategories(menuData.categories || []);
      setMenus(menuData.menus || []);

      // 2. Iniciar sesión de chat con La Nonna
      const sessionId = await startChatSession();
      setConvId(sessionId);
    }
    loadData();
  }, []);

  // --- Inicialización del Speech Recognition (Nativo) ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('SpeechRecognition: Verificando disponibilidad...', SpeechRecognition ? 'SOPORTADO ✅' : 'NO SOPORTADO ❌');
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true; // Captura de voz continua (manos libres)
      rec.lang = 'es-CL'; // Español de Chile
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        console.log('SpeechRecognition: Evento onstart - Iniciando grabación de audio continua');
        setStatus('listening');
        setTranscriptText('Escuchando...');
        // Detener cualquier audio previo del bot
        if (synthRef.current) synthRef.current.cancel();
      };

      rec.onresult = (event) => {
        // Ignorar resultados de voz si el bot está hablando o pensando para evitar bucles e interferencia
        if (statusRef.current === 'speaking' || statusRef.current === 'thinking') {
          console.log('SpeechRecognition: Ignorando resultado por estado activo del Bot:', statusRef.current);
          return;
        }

        // Obtener el último segmento de voz finalizado
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript.trim()) {
          console.log('SpeechRecognition: Texto final reconocido:', finalTranscript);
          setTranscriptText(`Tú dijiste: "${finalTranscript}"`);
          handleUserInput(finalTranscript);
        }
      };

      rec.onerror = (event) => {
        console.error('SpeechRecognition: Evento onerror - Código de error:', event.error);
        if (event.error === 'no-speech') {
          setTranscriptText('No detecto voz. Sigo escuchando...');
        } else if (event.error === 'not-allowed') {
          setTranscriptText('Permiso de micrófono denegado.');
          isSensorActiveRef.current = false;
          setIsSensorActive(false);
          alert('Permiso de micrófono denegado. Concede permisos al micrófono en la barra de navegación.');
        } else if (event.error === 'audio-capture') {
          setTranscriptText('No se detectó ningún micrófono físico.');
          isSensorActiveRef.current = false;
          setIsSensorActive(false);
        } else {
          setTranscriptText(`Error: ${event.error}.`);
        }
        setStatus('ready');
      };

      rec.onend = () => {
        console.log('SpeechRecognition: Evento onend - Captura detenida.');
        // Re-iniciar automáticamente si el sensor unificado sigue encendido y el bot no está hablando/pensando
        if (isSensorActiveRef.current && statusRef.current === 'ready') {
          console.log('SpeechRecognition: Reiniciando captura de voz automática...');
          setTimeout(() => {
            if (isSensorActiveRef.current && statusRef.current === 'ready') {
              try {
                rec.start();
              } catch (e) {
                console.warn('SpeechRecognition: Error al re-iniciar captura:', e.message);
              }
            }
          }, 300);
        } else {
          console.log('SpeechRecognition: No se reinicia en onend porque status =', statusRef.current);
        }
      };

      recognitionRef.current = rec;
    }
  }, []); // Carga una sola vez al montar para evitar fugas y múltiples listeners concurrentes

  // --- Procesamiento de Entrada de Usuario (Voz o Texto) ---
  const handleUserInput = async (text) => {
    if (!text.trim()) return;
    
    // Silenciar el micrófono de inmediato antes de procesar y hablar para evitar eco
    stopMicrophone();
    
    setStatus('thinking');
    setTranscriptText(`Procesando: "${text}"...`);

    const currentConvId = convIdRef.current;
    const currentMenus = menusRef.current;
    const currentCart = cartRef.current;
    const currentProfile = activeProfileRef.current;
    const currentOnboardingId = onboardingFaceIdRef.current;
    const isWaitingConf = waitingForConfirmationRef.current;

    const textClean = text.toLowerCase().trim();

    // ---- A. LÓGICA DE CONFIRMACIÓN DE PEDIDO ----
    if (isWaitingConf) {
      // 1. Palabras clave de Aceptación (Sí)
      const yesKeywords = [
        "si", "sí", "si estoy listo", "sí estoy listo", "si ya quiero comer", 
        "sí ya quiero comer", "todo listo", "pedido listo", "listo", "ya quiero comer",
        "confirmar", "confirmo", "mandar", "mándalo", "mandalo", "envíalo", "envialo"
      ];
      
      const isYes = yesKeywords.some(kw => textClean === kw || textClean.includes(kw));
      
      if (isYes) {
        setWaitingForConfirmation(false);
        setStatus('thinking');
        
        let kitchenReply = {
          text: "¡Excelente, bambino! Acabo de mandar tu pedido volando a la cocina. ¡Se comenzará a preparar de inmediato para que coman calientito y delicioso!",
          intent: "send_to_kitchen"
        };
        
        setBotResponse(kitchenReply.text);
        
        // Ejecutar envío
        const activeProf = activeProfileRef.current || currentProfile;
        const currentCartItems = cartRef.current || currentCart;
        
        if (activeProf && currentCartItems.length > 0) {
          const favoriteItemId = currentCartItems[0].id;
          const lastOrderIds = currentCartItems.map(item => item.id);
          const updatedProfile = {
            face_id: activeProf.face_id,
            name: activeProf.name,
            favorite_item_id: favoriteItemId,
            last_order_ids: lastOrderIds
          };
          await saveProfile(updatedProfile);
          setActiveProfile(updatedProfile);
        }
        
        setCart([]);
        setOrderSentActive(true);
        setTimeout(() => {
          setOrderSentActive(false);
        }, 6000);
        
        speakText(kitchenReply.text);
        return;
      }
      
      // 2. Palabras clave de Negativa / Agregar más
      const noKeywords = [
        "no todavía no", "no todavia no", "todavía no", "todavia no", "no", 
        "me falta algo mas", "me falta algo más", "todavía no termino", "todavia no termino",
        "quiero algo mas", "quiero algo más", "quiero", "me falta algo", "me falta"
      ];
      
      const isNo = noKeywords.some(kw => textClean.startsWith(kw) || textClean === kw);
      
      // Mapeo de platos para ver si pide algo específico (ej. "quiero un fetuccini alfredo" o "me falta un fetuccini")
      let matchedItem = null;
      
      const keywordsMap = {
        e1: ["bruschetta", "brusqueta", "tostadas", "tostada"],
        e2: ["carpaccio", "carpacio"],
        e3: ["calamares", "calamar", "anillos de calamar"],
        p1: ["margherita", "margarita", "pizza margherita", "pizza margarita"],
        p2: ["pepperoni", "peperoni", "pizza pepperoni", "pizza peperoni"],
        p3: ["formaggi", "quesos", "cuatro quesos", "pizza cuatro quesos", "pizza formaggi"],
        p4: ["nonna", "la nonna", "pizza la nonna"],
        p5: ["napolitana", "pizza napolitana"],
        pa1: ["fettuccine", "fettucini", "alfredo", "fettuccine alfredo", "fetuccini alfredo", "fetuccini"],
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

      for (const item of currentMenus) {
        const nameNorm = item.nombre.toLowerCase();
        const matchesKeyword = keywordsMap[item.id]?.some(kw => textClean.includes(kw));
        if (textClean.includes(nameNorm) || matchesKeyword || (item.codigo && textClean.includes(item.codigo.toLowerCase()))) {
          matchedItem = item;
          break;
        }
      }

      if (isNo || matchedItem) {
        setWaitingForConfirmation(false);
        
        if (matchedItem) {
          addToCart(matchedItem);
          const addText = `Perfecto, bambino. Te he agregado **${matchedItem.nombre}** a tu pedido. ¿Deseas algo más de mangiare o prefieres que lo enviemos a la cocina?`;
          setBotResponse(addText);
          speakText(addText);
        } else {
          const rejectText = "Perfecto, entonces ¿qué te gustaría agregar de mangiare, bambino?";
          setBotResponse(rejectText);
          speakText(rejectText);
        }
        return;
      }
      
      setWaitingForConfirmation(false);
    }

    // ---- B. INTERCEPTAR FRASES DIRECTAS DE LISTO ----
    const isReadyCommand = [
      "ya estoy listo", "estoy listo", "ya estoy listo con mi pedido",
      "ya estoy listo con el pedido", "ya listos"
    ].some(c => textClean.includes(c));
    
    if (isReadyCommand && !isWaitingConf) {
      setWaitingForConfirmation(true);
      const confText = "¿Ya tienes tu pedido listo, bambino? ¿Estás listo para mandarlo a la cocina, po?";
      setBotResponse(confText);
      speakText(confText);
      return;
    }

    let reply = null;

    // 1. Intentar enviar al backend real con motor AI y persistencia
    if (currentConvId) {
      try {
        const response = await sendChatMessage(
          currentConvId,
          text,
          currentCart,
          currentProfile,
          currentOnboardingId
        );
        if (response && response.text && response.intent) {
          reply = response;
          console.log('Procesado por el backend AI exitosamente:', reply);
        }
      } catch (err) {
        console.warn('Procesamiento de chat en el backend falló. Usando motor local de respaldo:', err.message);
      }
    }

    // 2. Procesar comando de manera local (Fallback offline si falla la conexión)
    if (!reply) {
      let commandProfile = currentProfile;
      if (currentOnboardingId && !currentProfile) {
        commandProfile = { onboarding: true };
      }
      reply = await processLocalCommand(text, currentMenus, currentCart, commandProfile);
      console.log('Procesado por el motor local offline:', reply);
    }

    // ---- C. INTERCEPTAR INTENTO "SEND_TO_KITCHEN" PARA PEDIR CONFIRMACIÓN ----
    if (reply.intent === 'send_to_kitchen' && !isWaitingConf) {
      setWaitingForConfirmation(true);
      const confText = "¿Ya tienes tu pedido listo, bambino? ¿Estás listo para mandarlo a la cocina, po?";
      setBotResponse(confText);
      speakText(confText);
      return;
    }

    // 3. Aplicar efectos según la intención detectada
    setBotResponse(reply.text);
    
    if (reply.highlightIds) {
      setHighlightedIds(reply.highlightIds);
      // Quitar destaque en 8 segundos
      setTimeout(() => {
        setHighlightedIds([]);
      }, 8000);
    } else {
      setHighlightedIds([]);
    }

    if (reply.addItem) {
      addToCart(reply.addItem);
    }

    if (reply.removeItem) {
      removeFromCart(reply.removeItem.id);
    }

    if (reply.intent === 'register_profile_success' && reply.registerName) {
      const newProfile = {
        face_id: onboardingFaceIdRef.current || currentOnboardingId,
        name: reply.registerName,
        favorite_item_id: null,
        last_order_ids: []
      };
      await saveProfile(newProfile);
      setActiveProfile(newProfile);
      setOnboardingFaceId(null);
    }

    if (reply.intent === 'send_to_kitchen') {
      const activeProf = activeProfileRef.current || currentProfile;
      const currentCartItems = cartRef.current || currentCart;
      
      if (activeProf && currentCartItems.length > 0) {
        // Guardar el primer plato del pedido actual como favorito
        const favoriteItemId = currentCartItems[0].id;
        const lastOrderIds = currentCartItems.map(item => item.id);
        const updatedProfile = {
          face_id: activeProf.face_id,
          name: activeProf.name,
          favorite_item_id: favoriteItemId,
          last_order_ids: lastOrderIds
        };
        await saveProfile(updatedProfile);
        setActiveProfile(updatedProfile);
      }
      
      setCart([]);
      setOrderSentActive(true);
      // Auto cerrar el modal en 6 segundos
      setTimeout(() => {
        setOrderSentActive(false);
      }, 6000);
    }

    if (reply.intent === 'bill') {
      // Activar efectos visuales de cuenta si es necesario
    }

    if (reply.intent === 'call_waiter') {
      triggerWaiterAlert();
    }

    // 4. Leer respuesta en voz alta si está habilitada
    speakText(reply.text);
  };

  // --- Sintetizador de Voz (TTS) ---
  const speakText = (text) => {
    const isVoiceEnabled = voiceEnabledRef.current;
    if (!isVoiceEnabled || !synthRef.current) {
      console.log('speakText: Voz deshabilitada o no disponible. Volviendo a escuchar...');
      setStatus('ready');
      if (isSensorActiveRef.current) {
        startMicrophone();
      }
      return;
    }

    // Cancelar diálogos anteriores
    synthRef.current.cancel();

    // Eliminar markdown básico antes de hablar para que no deletree asteriscos
    const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES'; // Castellano estándar
    utterance.rate = 1.05; // Velocidad ligeramente superior para mayor naturalidad
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setStatus('speaking');
    };

    utterance.onend = () => {
      console.log('speakText: El bot terminó de hablar. Reactivando micrófono...');
      setStatus('ready');
      if (isSensorActiveRef.current) {
        startMicrophone();
      }
    };

    utterance.onerror = (e) => {
      console.error('Error en síntesis de voz:', e);
      setStatus('ready');
      if (isSensorActiveRef.current) {
        startMicrophone();
      }
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  // --- Detector de Rostros ---
  const handleFaceDetected = async (emotion, faceId) => {
    const currentFaceId = faceId || 'face_user_a';
    
    // Evitar saludos repetitivos para el mismo rostro
    if (detectedFaceId === currentFaceId && activeProfile) return;
    
    if (detectedFaceId !== currentFaceId) {
      setDetectedFaceId(currentFaceId);
      
      // Consultar el perfil al backend
      const profile = await getProfile(currentFaceId);
      if (profile) {
        setActiveProfile(profile);
        setOnboardingFaceId(null);
        
        let favItemName = "";
        if (profile.favorite_item_id) {
          const item = menusRef.current.find(i => i.id === profile.favorite_item_id);
          if (item) favItemName = item.nombre;
        }
        
        let greeting = `¡Hola de nuevo, ${profile.name}, mio caro! Qué alegría tenerte de vuelta en la Piccola. Veo que hoy estás con ánimo ${emotion}. `;
        if (favItemName) {
          greeting += `¿Te traigo lo de siempre, bambino? Tu exquisito **${favItemName}**, o prefieres mirar la carta hoy, po?`;
        } else {
          greeting += `¿Qué te gustaría comer de rico hoy, bambino? ¿Te recomiendo una pasta de la Nonna?`;
        }
        
        setBotResponse(greeting);
        stopMicrophone();
        speakText(greeting);
      } else {
        setActiveProfile(null);
        setOnboardingFaceId(currentFaceId);
        
        const greeting = `¡Hola, bambino! Veo tu rostro en mi sensor biométrico, pero aún no nos conocemos, po. ¿Cómo te llamas para poder guardarte en la memoria de la casa y consentirte con lo que más te guste de mangiare?`;
        
        setBotResponse(greeting);
        stopMicrophone();
        speakText(greeting);
      }
    }
  };

  // --- Activador Unificado de Sensores (Cámara + Micrófono) ---
  const toggleSensor = () => {
    const nextState = !isSensorActive;
    console.log('toggleSensor: Cambiando estado del Garzón a:', nextState);
    setIsSensorActive(nextState);
    isSensorActiveRef.current = nextState;

    if (nextState) {
      // Activar Micrófono
      startMicrophone();
      // Reset de bandera de saludo de rostro por si se apaga y vuelve a prender
      hasGreetedForFaceRef.current = false;
      
      // Limpiar estados de reconocimiento al encender
      setDetectedFaceId(null);
      setActiveProfile(null);
      setOnboardingFaceId(null);
    } else {
      // Apagar Micrófono y Voz
      stopMicrophone();
      if (synthRef.current) synthRef.current.cancel();
      setTranscriptText('');
      setStatus('ready');
    }
  };

  const startMicrophone = () => {
    if (recognitionRef.current) {
      try {
        console.log('startMicrophone: Iniciando captura de voz continua...');
        recognitionRef.current.start();
      } catch (err) {
        console.warn('startMicrophone: Ya corriendo o error:', err.message);
      }
    }
  };

  const stopMicrophone = () => {
    if (recognitionRef.current) {
      try {
        console.log('stopMicrophone: Deteniendo captura de voz...');
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('stopMicrophone: Error al detener:', err.message);
      }
    }
  };

  // --- Alternar micrófono (Compatibilidad / Botón Central) ---
  const toggleListening = () => {
    toggleSensor(); // Ambos botones ahora hacen lo mismo para simplificar
  };

  // --- Control de Carrito de Compras ---
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prevCart, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  // --- Alertas y Eventos Especiales ---
  const triggerWaiterAlert = () => {
    setAlertWaiterActive(true);
  };

  const cancelWaiterAlert = () => {
    setAlertWaiterActive(false);
  };

  // Calcular montos
  const subtotal = cart.reduce((acc, item) => acc + item.precio * item.qty, 0);
  const propinaSugerida = Math.round(subtotal * 0.1);
  const total = subtotal + propinaSugerida;

  // Formatear CLP
  const formatCLP = (amount) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      
      {/* Banner de aviso de contexto inseguro (HTTP en red local) */}
      {isInsecureContext && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          background: 'rgba(224, 58, 58, 0.95)',
          color: '#fff',
          padding: '10px 20px',
          zIndex: 1000,
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(4px)'
        }}>
          <span>⚠️ <strong>Advertencia:</strong> El micrófono y la cámara no funcionarán bajo HTTP en tu red local. Accede desde <strong>localhost</strong>, habilita <strong>HTTPS</strong>, o agrega la IP en Chrome escribiendo <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>.</span>
          <button 
            onClick={() => setIsInsecureContext(false)}
            style={{ background: 'transparent', border: '1px solid #fff', color: '#fff', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 1. SIDEBAR IZQUIERDO: Mesa y Pedido actual */}
      <aside className="sidebar-left">
        <div className="sidebar-header">
          <h1 className="brand-title">
            LA PICCOLA <span className="brand-accent">ITALIA</span>
          </h1>
          <div className="table-badge">Mesa {tableNumber}</div>
        </div>

        {/* Cámara de lectura de Rostro */}
        <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'center' }}>
          <FaceScanner 
            onFaceDetected={handleFaceDetected} 
            isActive={isSensorActive} 
            profile={activeProfile}
          />
        </div>

        {/* Control Unificado de Garzón (Cámara + Micrófono Continuo) */}
        <div style={{ padding: '0 24px 12px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          <button 
            className={`action-btn ${isSensorActive ? 'btn-danger' : 'btn-primary'}`}
            onClick={toggleSensor}
            style={{ 
              borderRadius: 'var(--border-radius-sm)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px',
              fontWeight: '600',
              padding: '10px 14px',
              animation: isSensorActive && status === 'listening' ? 'pulseGlow 1.5s infinite' : 'none'
            }}
          >
            {isSensorActive ? (
              <>
                <MicOff size={16} /> Desactivar Garzón
              </>
            ) : (
              <>
                <Mic size={16} /> Activar Garzón Virtual
              </>
            )}
          </button>
          
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: '500' }}>
            {!isSensorActive && 'Apagado (Cámara y Micrófono)'}
            {isSensorActive && status === 'listening' && (activeProfile ? `🎤 Escuchando a ${activeProfile.name}...` : '🎤 Escuchando...')}
            {isSensorActive && status === 'thinking' && '⚙️ Procesando con La Nonna...'}
            {isSensorActive && status === 'speaking' && '🔊 Hablando...'}
            {isSensorActive && status === 'ready' && (
              activeProfile ? `Reconociendo a ${activeProfile.name} 👤` : 
              onboardingFaceId ? 'Esperando nombre de cliente nuevo... 🆕' : 
              'Listo y escuchando'
            )}
          </div>
        </div>

        <div className="order-list-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShoppingBag size={18} className="brand-accent" />
            <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Pedido Actual</h2>
          </div>

          {cart.length === 0 ? (
            <div className="empty-cart-message">
              El pedido está vacío.<br />Agrégale platos diciendo por ejemplo: <strong>"Tráeme una pizza margherita"</strong>.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-details">
                  <div className="cart-item-name">{item.nombre}</div>
                  <div className="cart-item-price">{formatCLP(item.precio)} c/u</div>
                  <div className="cart-item-quantity">
                    <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>-</button>
                    <span className="qty-val">{item.qty}</span>
                    <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                  </div>
                </div>
                <div className="cart-item-total">
                  {formatCLP(item.precio * item.qty)}
                </div>
                <button className="remove-btn" onClick={() => removeFromCart(item.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="order-footer">
          <div className="bill-summary">
            <div className="bill-row">
              <span>Subtotal</span>
              <span>{formatCLP(subtotal)}</span>
            </div>
            <div className="bill-row">
              <span>Sugerencia Propina (10%)</span>
              <span>{formatCLP(propinaSugerida)}</span>
            </div>
            <div className="bill-row bill-total">
              <span>Total Estimado</span>
              <span>{formatCLP(total)}</span>
            </div>
          </div>

          <button 
            className={`action-btn btn-success ${cart.length === 0 ? 'btn-disabled' : ''}`}
            disabled={cart.length === 0}
            onClick={() => handleUserInput("enviar a la cocina")}
            style={{ marginBottom: '4px' }}
          >
            <ChefHat size={16} /> Enviar Pedido a Cocina
          </button>

          <button 
            className={`action-btn btn-primary ${cart.length === 0 ? 'btn-disabled' : ''}`}
            disabled={cart.length === 0}
            onClick={() => handleUserInput("cuenta")}
          >
            <Receipt size={16} /> Pedir la Cuenta
          </button>
          
          <button 
            className="action-btn btn-danger"
            onClick={triggerWaiterAlert}
          >
            <Bell size={16} /> Llamar Garzón Físico
          </button>
        </div>
      </aside>

      {/* 2. PANEL CENTRAL: Avatar interactivo y controles de audio */}
      <main className="center-panel">
        
        {/* Encabezado del centro */}
        <div className="center-header">
          <h2 className="center-title">Garzón Virtual</h2>
          <div className="center-status">
            <span className={`status-dot ${status === 'listening' ? 'listening' : status === 'speaking' ? 'active' : ''}`}></span>
            {status === 'ready' && 'Listo para escucharte'}
            {status === 'listening' && 'Escuchando tu voz...'}
            {status === 'thinking' && 'Procesando con La Nonna AI...'}
            {status === 'speaking' && 'Hablando'}
          </div>
        </div>

        {/* Visualización del Avatar y ondas */}
        <div className="avatar-view">
          <div className="avatar-wrapper">
            <Avatar 
              isListening={status === 'listening'} 
              isSpeaking={status === 'speaking'} 
            />
          </div>
          
          {/* Ondas de audio reactivas */}
          <div className="audio-waves-container">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className={`wave-bar ${status === 'speaking' || status === 'listening' ? 'speaking' : ''}`}
                style={{
                  height: '40px',
                  // Alturas y transiciones aleatorias simuladas
                  transform: (status === 'speaking' || status === 'listening') 
                    ? `scaleY(${0.3 + Math.random() * 0.7})` 
                    : 'scaleY(0.1)'
                }}
              />
            ))}
          </div>
        </div>

        {/* Transcripción interactiva */}
        <div>
          <div className="transcript-bubble">
            <div className="transcript-label">Garzón Virtual responde</div>
            <div className="transcript-text">
              {botResponse}
            </div>
            
            {transcriptText && (
              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {transcriptText}
              </div>
            )}
          </div>

          {/* Tablero de controles */}
          <div className="controls-board">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              {/* Botón Silenciar Voz del Bot */}
              <button 
                className="qty-btn"
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                title={voiceEnabled ? "Silenciar garzón" : "Activar sonido del garzón"}
              >
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} style={{ color: 'var(--color-accent)' }} />}
              </button>

              {/* Botón Central de Micrófono */}
              <div className="mic-button-container">
                <button 
                  className={`mic-btn ${
                    !isSensorActive ? '' :
                    status === 'listening' ? 'listening' : 
                    status === 'speaking' ? 'speaking' : 
                    ''
                  }`}
                  onClick={toggleListening}
                  title={isSensorActive ? "Desactivar Garzón Virtual (Cámara y Micrófono)" : "Activar Garzón Virtual (Cámara y Micrófono)"}
                >
                  {isSensorActive && status === 'listening' ? <MicOff size={32} /> : <Mic size={32} />}
                </button>
              </div>

              {/* Botón Alternar Entrada Manual */}
              <button 
                className="qty-btn"
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                onClick={() => setShowManualInput(!showManualInput)}
                title="Escribir comando"
              >
                <MessageSquare size={18} />
              </button>

            </div>

            {/* Hint de uso */}
            <div className="status-text-hint" style={{ textAlign: 'center', maxWidth: '360px', margin: '0 auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {!isSensorActive && 'Presiona el círculo para activar el Garzón (Cámara + Micrófono)'}
              {isSensorActive && status === 'listening' && '🎤 Modo manos libres activo. Háblame sin apretar botones.'}
              {isSensorActive && status === 'thinking' && '⚙️ Procesando pedido...'}
              {isSensorActive && status === 'speaking' && '🔊 Garzón respondiendo...'}
              {isSensorActive && status === 'ready' && 'Listo, vuelve a hablar cuando quieras'}
            </div>

            {/* Input Manual de Texto (Opcional, para testing/accesibilidad) */}
            {showManualInput && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (textInputValue.trim()) {
                    handleUserInput(textInputValue);
                    setTextInputValue('');
                  }
                }}
                style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '400px', marginTop: '8px' }}
              >
                <input
                  type="text"
                  value={textInputValue}
                  onChange={(e) => setTextInputValue(e.target.value)}
                  placeholder='Ej: "Recomiéndame una pizza"'
                  style={{
                    flex: 1,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    borderRadius: 'var(--border-radius-sm)',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
                <button 
                  type="submit"
                  className="qty-btn" 
                  style={{ width: 'auto', padding: '0 16px', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-primary)', color: 'var(--bg-primary)', fontWeight: '600' }}
                >
                  Enviar
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Modal de Alerta Llamar Garzón Humano */}
        {alertWaiterActive && (
          <div className="overlay">
            <div className="overlay-card">
              <div className="overlay-icon-container">
                <Bell size={36} />
              </div>
              <h3 className="overlay-title">Llamando Garzón</h3>
              <p className="overlay-desc">
                Hemos notificado a la cocina y al equipo del salón. Un mesero de La Piccola Italia se acercará a la Mesa {tableNumber} en breve.
              </p>
              <button 
                className="action-btn btn-danger" 
                onClick={cancelWaiterAlert}
              >
                Cancelar Alerta
              </button>
            </div>
          </div>
        )}

        {/* Modal de Confirmación Enviar Pedido a Cocina */}
        {orderSentActive && (
          <div className="overlay">
            <div className="overlay-card-success">
              <div className="overlay-icon-container-success">
                <CheckCircle size={36} />
              </div>
              <h3 className="overlay-title" style={{ color: '#22c55e' }}>Pedido en Cocina</h3>
              <p className="overlay-desc">
                ¡Tu pedido ha sido enviado con éxito a la cocina de La Piccola Italia! Se comenzará a preparar de inmediato para la Mesa {tableNumber}.
              </p>
              <button 
                className="action-btn btn-success" 
                onClick={() => setOrderSentActive(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. SIDEBAR DERECHO: Catálogo Digital de Platos */}
      <aside className="sidebar-right">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Nuestra Carta</h2>
          </div>
        </div>

        <MenuCatalog 
          categories={categories} 
          menus={menus} 
          highlightedIds={highlightedIds} 
          onAddItem={addToCart} 
        />
      </aside>

    </div>
  );
}
