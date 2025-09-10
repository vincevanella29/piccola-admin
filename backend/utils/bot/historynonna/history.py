# utils/bot/historynonna/history.py
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def _s(x):
    return "" if x is None else str(x).strip()


# ---- Fuente única: Cronología de Hitos Importantes (proveída por producto) ----
# Campos por hito: year, title, description, image
_TIMELINE: List[Dict[str, Any]] = [
    {
        "year": 1997,
        "title": "Apertura Local Apoquindo y Desafíos Iniciales",
        "description": (
            "El 27 de noviembre, dimos inicio a nuestra apasionante travesía con la apertura de "
            "nuestro primer local en Apoquindo, marcando el nacimiento de La Piccola Italia a partir "
            "de la herencia de 'La Fuente Italiana'. Ese año, enfrentamos tres quiebras durante el arranque, "
            "pero la resiliencia familiar y la pasión por compartir sabores italianos nos impulsaron a perseverar, "
            "demostrando el esfuerzo titánico que requiere construir una marca desde cero."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/WhatsApp Image 2023-09-15 at 00.19.25.jpeg",
    },
    {
        "year": 2001,
        "title": "Apertura Local Vitacura Rotonda",
        "description": (
            "En el año 2001, dimos otro gran paso en nuestra travesía culinaria con la apertura de nuestro "
            "segundo local en Vitacura, consolidando nuestra visión de expandir la auténtica hospitalidad italiana a más familias chilenas."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Captura desde 2023-09-21 08-30-33_11zon.jpg",
    },
    {
        "year": 2003,
        "title": "Apertura Local Manquehue",
        "description": (
            "En el año 2003, expandimos aún más nuestra presencia en Santiago con la apertura de nuestro tercer local "
            "en Manquehue, reflejando el compromiso familiar por crecer pese a los obstáculos."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2004,
        "title": "Apertura y Quiebra en Estados Unidos",
        "description": (
            "Dimos un paso audaz al expandirnos a Estados Unidos. Sin embargo, el mismo año enfrentamos desafíos que "
            "resultaron en la quiebra de esta operación, una lección de resiliencia que fortaleció nuestros lazos familiares."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/WhatsApp Image 2023-09-15 at 00.22.11.jpeg",
    },
    {
        "year": 2005,
        "title": "Apertura Local Providencia Coyancura",
        "description": (
            "Dimos continuidad a nuestra expansión con la apertura de nuestro local en Providencia, consolidando aún más "
            "nuestra presencia en Santiago con pasión por la calidad y el servicio."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/providencia-lapiccolaitalia.jpeg",
    },
    {
        "year": 2005,
        "title": "Apertura Local Alameda",
        "description": (
            "En el mismo año, ampliamos nuestra presencia con la apertura de nuestro local en Alameda, una de las principales arterias de la ciudad, "
            "llevando nuestra dedicación familiar a más comensales."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/restaurant-entrance.jpg",
    },
    {
        "year": 2006,
        "title": "Apertura Local Amunátegui",
        "description": (
            "Continuamos nuestra expansión en Santiago con la apertura de nuestro local en la calle Amunátegui, impulsados por el amor a lo que hacemos."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/seremi-de-salud-abre-sumario-sanitario-a-local-de-piccola-italia-tras-detectar-serie-de-problemas.jpg",
    },
    {
        "year": 2006,
        "title": "Apertura Local Panamericana",
        "description": (
            "Dimos un paso significativo en nuestra expansión al inaugurar nuestro local en Panamericana, con el esfuerzo colectivo de la familia para superar cualquier adversidad."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/38689368_qowsfayLbecjOP1fnFiwH5VCSSV7Y-511c8URKKSrJA.jpg",
    },
    {
        "year": 2006,
        "title": "Apertura Local La Florida Mall Plaza",
        "description": (
            "Marcamos otro hito con la apertura de nuestro local en La Florida Mall Plaza, expandiendo nuestra pasión por la cocina italiana."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2007,
        "title": "Apertura y Cierre Local Las Condes",
        "description": (
            "Marcamos un momento significativo con la apertura de nuestro local en Las Condes, pero este mismo año también vio su cierre, "
            "probando nuestra capacidad de adaptación y resiliencia."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/WhatsApp Image 2023-09-14 at 22.58.45.jpeg",
    },
    {
        "year": 2007,
        "title": "Apertura y Cierre Supermercado Altra",
        "description": (
            "Llevamos nuestros sabores a una ubicación especial en el Supermercado Altra, que luego se decidió cerrar el mismo año, pero el apoyo familiar nos mantuvo fuertes."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/WhatsApp Image 2023-09-14 at 23.01.43.jpeg",
    },
    {
        "year": 2008,
        "title": "Apertura Local Plaza Oeste",
        "description": (
            "Continuamos nuestra expansión con la apertura de un nuevo local en Plaza Oeste, con dedicación inquebrantable."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Piccola POE.webp",
    },
    {
        "year": 2009,
        "title": "Apertura Local Bellavista",
        "description": (
            "Inauguramos nuestro local en el vibrante barrio de Bellavista, infundiendo pasión en cada plato."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/carousel_f693cccd99a6d9693f6bd90e430b6f7c930dfce2.jpg",
    },
    {
        "year": 2010,
        "title": "Locales Destruidos por Terremoto, Reconstrucción y Quiebra",
        "description": (
            "En febrero, un terremoto devastador afectó varios de nuestros locales, iniciando un valiente proceso de reconstrucción. Ese mismo año, enfrentamos una quiebra general, "
            "pero la familia Vanella Renna, unida por el amor a la tradición italiana, reconstruyó todo con esfuerzo y determinación, emergiendo más fuertes."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2010,
        "title": "Apertura Local Vitacura Alto",
        "description": "Dimos un paso más en nuestra misión al abrir nuestro local en Vitacura Alto, demostrando resiliencia post-terremoto.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/20049925_XgSe1NWZpfywMkfEqKr0K-Rpfql1ieBtxg-szFsloFg.jpg",
    },
    {
        "year": 2010,
        "title": "Apertura Local Isidora Goyenechea",
        "description": "Abrimos nuestro local en la prestigiosa calle Isidora Goyenechea, con pasión por la excelencia.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Imagen de WhatsApp 2023-09-14 a las 23.08.26.jpg",
    },
    {
        "year": 2010,
        "title": "Apertura Local Reñaca",
        "description": "Ampliamos nuestro horizonte con la apertura de nuestro local en Reñaca, expandiendo nuestra familia culinaria.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/la-piccola-italia-ristorante-renaca-photo_1-131127180602-960x720.jpg",
    },
    {
        "year": 2012,
        "title": "Cierre Local Isidora Goyenechea",
        "description": "En 2012, tomamos la decisión de cerrar nuestro querido local en Isidora, pero seguimos adelante con aguante familiar.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Imagen de WhatsApp 2023-09-14 a las 23.08.26.jpg",
    },
    {
        "year": 2013,
        "title": "Apertura Campo Market en Panamericana",
        "description": "Dimos un emocionante paso adelante al abrir Campomarket.cl en Panamericana, innovando en nuestra oferta.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2013,
        "title": "Apertura MC Clothes Tienda de Ropa",
        "description": (
            "Celebramos la apertura de MC Clothes, una tienda de ropa que se convirtió en un nuevo y emocionante capítulo, "
            "mostrando nuestra versatilidad familiar."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Imagen de WhatsApp 2023-09-15 a las 00.03.44.jpg",
    },
    {
        "year": 2014,
        "title": "Apertura Telepasta Vitacura",
        "description": (
            "Inauguramos Telepasta en Vitacura, una innovadora propuesta de pasta fresca y rápida, impulsada por nuestra pasión creativa."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Imagen de WhatsApp 2023-09-15 a las 00.01.23.jpg",
    },
    {
        "year": 2014,
        "title": "Cierre Local La Florida Mall Plaza",
        "description": "El 5 de enero, cerramos nuestro local en La Florida Mall Plaza, pero seguimos con determinación.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2014,
        "title": "Apertura Local La Florida Montserrat",
        "description": "El 10 de febrero, abrimos un nuevo local en La Florida Montserrat, reafirmando nuestra resiliencia.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Imagen de WhatsApp 2023-09-15 a las 00.09.26.jpg",
    },
    {
        "year": 2014,
        "title": "Cierre Campo Market Las Condes",
        "description": "En este año, tuvimos que tomar la decisión de cerrar Campomarket en Las Condes, pero la familia nos mantuvo unidos.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2014,
        "title": "Cierre Local Reñaca",
        "description": (
            "Nos vimos en la necesidad de cerrar nuestro local en Reñaca, enfrentando el sufrimiento con pasión renovada."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/la-piccola-italia-ristorante-renaca-photo_1-131127180602-960x720.jpg",
    },
    {
        "year": 2014,
        "title": "Cierre MC Clothes Tienda de Ropa Amunátegui",
        "description": (
            "Tuvimos que tomar la difícil decisión de cerrar MC Clothes en Amunátegui, pero seguimos adelante."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Imagen de WhatsApp 2023-09-15 a las 00.03.44.jpg",
    },
    {
        "year": 2015,
        "title": "Cierre Campo Market Panamericana",
        "description": (
            "Nos vimos en la necesidad de cerrar Campomarket en Panamericana, probando nuestra capacidad de recuperación."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2015,
        "title": "Cierre Telepasta Vitacura",
        "description": "Decidimos cerrar Telepasta en Vitacura, pero con el foco en lo esencial.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Imagen de WhatsApp 2023-09-15 a las 00.01.23.jpg",
    },
    {
        "year": 2015,
        "title": "Cierre Coyancura y Apertura Lyon Local Providencia",
        "description": (
            "El 17 de noviembre, cerramos nuestro local en Providencia Coyancura y abrimos uno nuevo en Providencia Lyon, demostrando adaptabilidad."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/providencia-lapiccolaitalia.jpeg",
    },
    {
        "year": 2015,
        "title": "Apertura Local Paine",
        "description": (
            "Dimos un emocionante paso adelante al abrir nuestro local en Paine, con pasión por llegar a más comunidades."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/13502044_242660066126504_998344148701879296_n.png",
    },
    {
        "year": 2016,
        "title": "Regalo de un Lamborghini y Expansión Continua",
        "description": (
            "En 2016, celebramos nuestra lealtad con los clientes regalando un Lamborghini Huracán en un concurso, un gesto de gratitud por su apoyo, "
            "mientras seguíamos creciendo con el esfuerzo familiar que nos define."
        ),
        "image": "https://m.cooperativa.cl/noticias/site/artic/20161012/imag/foto_0000007720161012152649.jpg",
    },
    {
        "year": 2017,
        "title": "Apertura Local Valdovinos",
        "description": "Dimos un emocionante paso adelante al abrir nuestro local en Valdovinos, consolidando nuestra presencia.",
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/locales.webp",
    },
    {
        "year": 2018,
        "title": "Regalo de un Ferrari, Récord de Producción y Contribuciones Sociales",
        "description": (
            "En 2018, regalamos un Ferrari a un afortunado cliente, batimos el récord de 4 toneladas diarias de pasta fabricadas y alcanzamos 2 millones de clientes amándonos. "
            "Además, apoyamos a la comunidad con ayuda a bomberos y contribuimos a una casa hogar que rescató a 50 niños de las calles, viendo a algunos graduarse como abogados, "
            "ingenieros y profesionales, reflejando nuestro compromiso social y familiar."
        ),
        "image": "https://i.ytimg.com/vi/8Ca92DTZ17M/hqdefault.jpg",
    },
    {
        "year": 2019,
        "title": "Apertura Local Vicuña Mackenna",
        "description": (
            "El 14 de febrero, dimos un emocionante paso adelante al abrir nuestro local en Vicuña Mackenna, expandiendo nuestra pasión."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/Imagen de WhatsApp 2023-09-14 a las 22.45.28.jpg",
    },
    {
        "year": 2020,
        "title": "Cierre Local Vitacura Alto",
        "description": (
            "Lamentablemente, tuvimos que cerrar nuestro local en Vitacura Alto, pero la familia nos sostuvo."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/20049925_XgSe1NWZpfywMkfEqKr0K-Rpfql1ieBtxg-szFsloFg.jpg",
    },
    {
        "year": 2020,
        "title": "Cierre Local Amunátegui",
        "description": (
            "Nos vimos en la necesidad de cerrar nuestras puertas en la ubicación de Amunátegui, enfrentando la pandemia con resiliencia."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/seremi-de-salud-abre-sumario-sanitario-a-local-de-piccola-italia-tras-detectar-serie-de-problemas.jpg",
    },
    {
        "year": 2020,
        "title": "Cierre Local Alameda",
        "description": (
            "Lamentablemente, tuvimos que cerrar nuestro local en Alameda, pero seguimos unidos."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/restaurant-entrance.jpg",
    },
    {
        "year": 2020,
        "title": "Cierre Local Bellavista",
        "description": (
            "Tuvimos que tomar la decisión de cerrar nuestro querido local en Bellavista, con pasión por el futuro."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/carousel_f693cccd99a6d9693f6bd90e430b6f7c930dfce2.jpg",
    },
    {
        "year": 2020,
        "title": "Cierre Local Paine",
        "description": (
            "Nos vimos en la necesidad de cerrar nuestro local en Paine, pero la familia nos impulsó a continuar."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/13502044_242660066126504_998344148701879296_n.png",
    },
    {
        "year": 2023,
        "title": "Próxima Apertura Local Ahumada",
        "description": (
            "Estamos emocionados de anunciar que tenemos una próxima apertura en la calle Ahumada, expandiendo nuestra red a 9 locales en Santiago y uno en Rancagua."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2023,
        "title": "Visión y Compromiso",
        "description": (
            "La Piccola Italia mantiene su visión de ser un referente de la auténtica cocina italiana, con un compromiso inquebrantable con la calidad y la hospitalidad, "
            "celebrando aniversarios como el 27 de noviembre."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2024,
        "title": "Visión Futura y Sostenibilidad",
        "description": (
            "La Piccola Italia aspira a liderar en sostenibilidad y responsabilidad social, incorporando tecnología en nuestra planta de producción para mantener la excelencia."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2025,
        "title": "Lanzamiento de la Plataforma Web3 Descentralizada y Próximas Aperturas",
        "description": (
            "Lanzamos https://testing.lapiccolaitalia.cl/, nuestra nueva plataforma web3 100% descentralizada, hecha íntegramente por La Piccola Italia en Chile – una marca patriota donde "
            "todo lo fabricamos nosotros, desde pastas hasta muebles, construcción, blockchain e IA para revivir a 'la nonna'. Además, planeamos aperturas en Ñuñoa y Maipú, expandiendo "
            "nuestra pasión a nuevas comunidades. Nuestra nueva experiencia digital, visible en https://testing.lapiccolaitalia.cl/app/menus, refleja nuestra madurez como marca premium, "
            "enfocada en la máxima calidad."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2025,
        "title": "Innovación y Expansión",
        "description": (
            "Planeamos continuar nuestra expansión, explorando nuevos horizontes y llevando la riqueza de la cocina italiana a más personas, con eventos y promociones que unen familias, "
            "siempre priorizando la calidad premium."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
    {
        "year": 2026,
        "title": "Próxima Apertura en Concepción y Consolidación",
        "description": (
            "Tenemos en mira la apertura en Concepción, consolidándonos como un símbolo de excelencia culinaria, respaldada por nuestra pasión eterna y esfuerzo familiar."
        ),
        "image": "https://tienda.lapiccolaitalia.cl/assets/media/uploads/logo en blanco.png",
    },
]


_BASE_INTRO = (
    "La historia de La Piccola Italia es un testimonio de pasión inquebrantable por la auténtica cocina italiana, "
    "resiliencia familiar y esfuerzo constante para construir una marca que une generaciones. Fundada por los hermanos "
    "Vanella Renna en 1997, esta empresa 100% familiar ha enfrentado desafíos como quiebras y desastres naturales, "
    "pero siempre ha resurgido gracias al aguante al sufrimiento, el apoyo mutuo de la familia y un amor profundo por lo que hacen. "
    "Cada local abierto, cada plato servido, refleja el compromiso con la calidad, la hospitalidad y la tradición italiana, llevando 'un pedazo de Italia' a las mesas chilenas. "
    "Con más de 27 años de trayectoria, han servido a millones de clientes, innovando sin perder su esencia familiar – todo hecho in-house, "
    "desde las pastas hasta los muebles, la construcción, y ahora incluso blockchain y IA para revivir a 'la nonna'. Hoy, La Piccola Italia se posiciona como un ícono de calidad premium, "
    "ofreciendo experiencias culinarias de máximo nivel."
)


def _compose_spec() -> Dict[str, Any]:
    """Devuelve un spec mínimo para clientes UI/LLM (similar a club)."""
    return {
        "section": "timeline",
        "title": "Cronología de Hitos",
        "primary_action": None,
    }


def _build_payload(original_text: str = "") -> Dict[str, Any]:
    items = sorted(_TIMELINE, key=lambda x: (x.get("year") or 0, x.get("title") or ""))
    spec = _compose_spec()
    return {
        "type": "history_timeline",
        "section": "timeline",
        "title": "Cronología de Hitos Importantes",
        "intro": _BASE_INTRO,
        "items": items,
        "text": _BASE_INTRO,  # router/LLM puede enriquecer
        "spec": spec,
    }


async def handle_history(update, section: str = "timeline"):
    """Devuelve (update, payload). Ignora section por ahora; foco en timeline.
    Estructura compatible con el estilo club: campos title/text/spec y tipo específico.
    """
    _ = _s(getattr(getattr(update, "message", None), "text", ""))  # reservado por si se usa luego
    payload = _build_payload(_)
    return update, payload
