import React, { useState } from 'react';
import { Plus } from 'lucide-react';

/**
 * MenuCatalog Component
 * Muestra el menú digital clasificado en pestañas de categorías y tarjetas de productos.
 * Permite destacar productos específicos que la IA del Garzón recomiende.
 * 
 * @param {Object} props
 * @param {Array} props.categories - Categorías de platos
 * @param {Array} props.menus - Listado de platos
 * @param {Array} props.highlightedIds - Array con los IDs de platos sugeridos por el Garzón
 * @param {Function} props.onAddItem - Callback para agregar plato al pedido
 */
export default function MenuCatalog({ categories = [], menus = [], highlightedIds = [], onAddItem }) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || '');

  // Si no hay categorías inicialmente pero luego se cargan, actualiza la categoría activa
  React.useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // Filtrar platos de la categoría activa
  const filteredProducts = menus.filter(product => {
    // Si la categoría tiene listado de IDs de menú
    const categoryObj = categories.find(c => c.id === activeCategory);
    if (categoryObj && categoryObj.menu_ids) {
      return categoryObj.menu_ids.includes(product.id);
    }
    // Fallback: buscar por categoria_id en el producto
    return product.categoria_id === activeCategory;
  });

  // Helper para formatear dinero en pesos chilenos
  const formatCLP = (amount) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Pestañas de Categoría */}
      <div className="categories-container">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Listado de Platos */}
      <div className="catalog-list">
        {filteredProducts.length === 0 ? (
          <div className="empty-cart-message">
            No hay productos disponibles en esta categoría.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isHighlighted = highlightedIds.includes(product.id);
            const initialLetter = product.nombre ? product.nombre.charAt(0) : '🍝';
            
            return (
              <div 
                key={product.id} 
                className={`catalog-item ${isHighlighted ? 'highlighted' : ''}`}
              >
                {/* Imagen del plato con Fallback de texto si está vacía */}
                {product.imagen_url ? (
                  <img 
                    src={product.imagen_url} 
                    alt={product.nombre} 
                    className="catalog-item-image"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="catalog-item-image placeholder"
                  style={{ display: product.imagen_url ? 'none' : 'flex' }}
                >
                  {initialLetter}
                </div>

                {/* Información del plato */}
                <div className="catalog-item-info">
                  <div>
                    <h3 className="catalog-item-name">{product.nombre}</h3>
                    <p className="catalog-item-desc">{product.descripcion}</p>
                  </div>
                  
                  <div className="catalog-item-footer">
                    <span className="catalog-item-price">{formatCLP(product.precio)}</span>
                    <button
                      className="add-to-cart-btn"
                      onClick={() => onAddItem(product)}
                      title="Agregar al pedido"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
