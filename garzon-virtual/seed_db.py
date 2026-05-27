# garzon-virtual/seed_db.py
import os
import logging
from datetime import datetime
from pymongo import MongoClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed-db")

# Load environment
def load_backend_env():
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "backend", ".env"),
        os.path.join("c:\\", "Users", "angelo", "Vanellix", "Piccola_admin", "backend", ".env")
    ]
    for path in possible_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip().strip('"\'')
            return

load_backend_env()

mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/piccola_italia_admin")
logger.info(f"Connecting to MongoDB at: {mongo_uri}")

try:
    client = MongoClient(mongo_uri)
    db = client.get_database()
    
    # 1. Define Categories
    categories_data = [
        {"_id": "cat_entradas", "nombre": "Entradas 🥗", "alias": "Entradas", "estado": True, "prioridad": 1, "menu_type": "carta", "menu_ids": ["e1", "e2", "e3"]},
        {"_id": "cat_pizzas", "nombre": "Pizzas 🍕", "alias": "Pizzas", "estado": True, "prioridad": 2, "menu_type": "carta", "menu_ids": ["p1", "p2", "p3", "p4", "p5"]},
        {"_id": "cat_pastas", "nombre": "Pastas 🍝", "alias": "Pastas", "estado": True, "prioridad": 3, "menu_type": "carta", "menu_ids": ["pa1", "pa2", "pa3", "pa4", "pa5"]},
        {"_id": "cat_bebidas", "nombre": "Bebidas y Tragos 🍷", "alias": "Bebidas", "estado": True, "prioridad": 4, "menu_type": "carta", "menu_ids": ["b1", "b2", "b3", "b4", "b5"]},
        {"_id": "cat_postres", "nombre": "Postres 🍰", "alias": "Postres", "estado": True, "prioridad": 5, "menu_type": "carta", "menu_ids": ["po1", "po2", "po3", "po4"]}
    ]
    
    # 2. Define Menus (Products)
    menus_data = [
        # Entradas
        {
            "_id": "e1",
            "nombre": "Bruschetta Tradizionale",
            "precio": 4900,
            "descripcion": "Tostadas de pan casero al ajo con tomates frescos picados, albahaca y aceite de oliva virgen extra.",
            "categoria_ids": ["cat_entradas"],
            "codigo": "ENT_BRUS",
            "estado": True,
            "prioridad": 1
        },
        {
            "_id": "e2",
            "nombre": "Carpaccio de Res",
            "precio": 7900,
            "descripcion": "Finas láminas de lomo de res con alcaparras, rúcula, queso parmesano y aderezo de limón.",
            "categoria_ids": ["cat_entradas"],
            "codigo": "ENT_CARP",
            "estado": True,
            "prioridad": 2
        },
        {
            "_id": "e3",
            "nombre": "Calamares Fritos",
            "precio": 6900,
            "descripcion": "Anillos de calamar apanados crujientes acompañados de salsa tártara de la casa.",
            "categoria_ids": ["cat_entradas"],
            "codigo": "ENT_CALA",
            "estado": True,
            "prioridad": 3
        },
        # Pizzas
        {
            "_id": "p1",
            "nombre": "Pizza Margherita",
            "precio": 8900,
            "descripcion": "Salsa de tomate casera, queso mozzarella premium, albahaca fresca y aceite de oliva.",
            "categoria_ids": ["cat_pizzas"],
            "codigo": "PIZ_MAR",
            "estado": True,
            "prioridad": 1
        },
        {
            "_id": "p2",
            "nombre": "Pizza Pepperoni",
            "precio": 9900,
            "descripcion": "Salsa de tomate, queso mozzarella abundante y doble porción de pepperoni artesanal.",
            "categoria_ids": ["cat_pizzas"],
            "codigo": "PIZ_PEP",
            "estado": True,
            "prioridad": 2
        },
        {
            "_id": "p3",
            "nombre": "Pizza Quattro Formaggi",
            "precio": 10900,
            "descripcion": "Exquisita combinación de queso mozzarella, gorgonzola, parmesano y provolone.",
            "categoria_ids": ["cat_pizzas"],
            "codigo": "PIZ_FOR",
            "estado": True,
            "prioridad": 3
        },
        {
            "_id": "p4",
            "nombre": "Pizza La Nonna",
            "precio": 11500,
            "descripcion": "Jamón serrano, rúcula fresca, láminas de queso parmesano y reducción de balsámico.",
            "categoria_ids": ["cat_pizzas"],
            "codigo": "PIZ_NON",
            "estado": True,
            "prioridad": 4
        },
        {
            "_id": "p5",
            "nombre": "Pizza Napolitana",
            "precio": 9200,
            "descripcion": "Salsa de tomate, mozzarella, rodajas de tomate fresco, orégano y aceitunas negras.",
            "categoria_ids": ["cat_pizzas"],
            "codigo": "PIZ_NAP",
            "estado": True,
            "prioridad": 5
        },
        # Pastas
        {
            "_id": "pa1",
            "nombre": "Fettuccine Alfredo con Pollo",
            "precio": 9500,
            "descripcion": "Pasta fresca salteada en salsa de crema de leche de primera, parmesano y tiras de pollo a la plancha.",
            "categoria_ids": ["cat_pastas"],
            "codigo": "PAS_ALF",
            "estado": True,
            "prioridad": 1
        },
        {
            "_id": "pa2",
            "nombre": "Lasagna Boloñesa",
            "precio": 10200,
            "descripcion": "Capas alternadas de pasta al huevo, salsa ragú de carne, bechamel y gratinado de mozzarella.",
            "categoria_ids": ["cat_pastas"],
            "codigo": "PAS_LAS",
            "estado": True,
            "prioridad": 2
        },
        {
            "_id": "pa3",
            "nombre": "Gnocchi al Pesto Genovese",
            "precio": 8900,
            "descripcion": "Ñoquis de papa hechos a mano con salsa tradicional de albahaca fresca, piñones y parmesano.",
            "categoria_ids": ["cat_pastas"],
            "codigo": "PAS_GNO",
            "estado": True,
            "prioridad": 3
        },
        {
            "_id": "pa4",
            "nombre": "Ravioles de Espinaca y Ricotta",
            "precio": 9200,
            "descripcion": "Pasta rellena de espinaca orgánica y ricotta cremosa en salsa pomodoro casera.",
            "categoria_ids": ["cat_pastas"],
            "codigo": "PAS_RAV",
            "estado": True,
            "prioridad": 4
        },
        {
            "_id": "pa5",
            "nombre": "Spaghetti Carbonara",
            "precio": 8900,
            "descripcion": "Receta italiana con tocino crujiente, yema de huevo fresca, queso pecorino y pimienta negra.",
            "categoria_ids": ["cat_pastas"],
            "codigo": "PAS_CARB",
            "estado": True,
            "prioridad": 5
        },
        # Bebidas
        {
            "_id": "b1",
            "nombre": "Pisco Sour La Piccola",
            "precio": 4500,
            "descripcion": "Pisco chileno de 40 grados, jugo fresco de limón de pica, jarabe de goma y clara de huevo.",
            "categoria_ids": ["cat_bebidas"],
            "codigo": "BEB_SOUR",
            "estado": True,
            "prioridad": 1
        },
        {
            "_id": "b2",
            "nombre": "Copa de Vino Reserva Tinto",
            "precio": 3800,
            "descripcion": "Vino Cabernet Sauvignon seleccionado de bodegas del Valle del Maipo.",
            "categoria_ids": ["cat_bebidas"],
            "codigo": "BEB_VIN_T",
            "estado": True,
            "prioridad": 2
        },
        {
            "_id": "b3",
            "nombre": "Copa de Vino Reserva Blanco",
            "precio": 3800,
            "descripcion": "Vino Sauvignon Blanc refrescante con notas cítricas.",
            "categoria_ids": ["cat_bebidas"],
            "codigo": "BEB_VIN_B",
            "estado": True,
            "prioridad": 3
        },
        {
            "_id": "b4",
            "nombre": "Coca-Cola (Lata)",
            "precio": 2200,
            "descripcion": "Bebida gaseosa helada de 350ml.",
            "categoria_ids": ["cat_bebidas"],
            "codigo": "BEB_COCA",
            "estado": True,
            "prioridad": 4
        },
        {
            "_id": "b5",
            "nombre": "Aperol Spritz",
            "precio": 5900,
            "descripcion": "Aperol, espumante Prosecco, agua mineral con gas y rodaja de naranja fresca.",
            "categoria_ids": ["cat_bebidas"],
            "codigo": "BEB_APERO",
            "estado": True,
            "prioridad": 5
        },
        # Postres
        {
            "_id": "po1",
            "nombre": "Tiramisú Tradizionale",
            "precio": 4200,
            "descripcion": "Auténtico tiramisú con bizcochos humedecidos en café espresso, Amaretto y crema de mascarpone.",
            "categoria_ids": ["cat_postres"],
            "codigo": "POS_TIR",
            "estado": True,
            "prioridad": 1
        },
        {
            "_id": "po2",
            "nombre": "Panna Cotta con Frutos del Bosque",
            "precio": 3900,
            "descripcion": "Flan cremoso de vainilla con salsa tibia de arándanos, frambuesas y moras.",
            "categoria_ids": ["cat_postres"],
            "codigo": "POS_PAN",
            "estado": True,
            "prioridad": 2
        },
        {
            "_id": "po3",
            "nombre": "Volcán de Chocolate con Helado",
            "precio": 4500,
            "descripcion": "Bizcocho tibio de chocolate relleno de fudge derretido con helado de vainilla.",
            "categoria_ids": ["cat_postres"],
            "codigo": "POS_VOLC",
            "estado": True,
            "prioridad": 3
        },
        {
            "_id": "po4",
            "nombre": "Gelato Italiano (2 sabores)",
            "precio": 3500,
            "descripcion": "Helado artesanal a elección: Chocolate belga, Vainilla, Frutilla o Limón de Pica.",
            "categoria_ids": ["cat_postres"],
            "codigo": "POS_GELA",
            "estado": True,
            "prioridad": 4
        }
    ]

    # Delete existing empty collections to avoid duplicates if re-run
    db.menus.delete_many({})
    db.categories.delete_many({})
    
    # Insert new seeded catalog
    logger.info("Inserting seeded categories...")
    db.categories.insert_many(categories_data)
    
    logger.info("Inserting seeded menus...")
    db.menus.insert_many(menus_data)
    
    logger.info(f"DB Seeding completed successfully. {len(categories_data)} categories and {len(menus_data)} products inserted.")

except Exception as e:
    logger.error(f"Error seeding MongoDB: {e}")
