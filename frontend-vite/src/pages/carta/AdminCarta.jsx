import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Package, Tags, Search, Loader2, Trash2, CheckCircle, SlidersHorizontal, Zap, BookOpen, Database, Layers } from 'lucide-react';

import useCartaAdmin from '../../hooks/useCartaAdmin';
import ProductModal from './components/ProductModal';
import CategoryModal from './components/CategoryModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import BulkActionsBar from './components/BulkActionsBar';
import ProductsTable from './components/ProductsTable';
import CategoriesTable from './components/CategoriesTable';
import LocationButtonsManager from './components/LocationButtonsManager';
import AIImagenModal from './components/AIImagenModal';
import MtzMissingTable from './components/MtzMissingTable';
import MenuOptionsManager from './components/MenuOptionsManager';

// ── Segmented Tab ─────────────────────────────────────────────────────────────
const SegmentedTab = ({ id, active, onClick, icon: Icon, label, count }) => (
    <button onClick={() => onClick(id)}
        className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${active
            ? 'text-light-text-primary dark:text-dark-text-primary bg-white dark:bg-dark-surface shadow-sm'
            : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
        }`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        {count != null && (
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${active
                ? 'bg-light-accent/10 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent'
                : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'
            }`}>{count}</span>
        )}
    </button>
);

// ─────────────────────────────────────────────────────────────────────────────

const AdminCarta = ({ appState }) => {
    const { t } = useTranslation();
    const {
        products, categories, locations, menuOptions, isLoading, isSyncing,
        fetchAll, refresh, patchProduct, updateProduct, createProduct, updateCategory, createCategory,
        uploadProductImage, triggerPublicSync, cleanDatabaseDuplicates,
        deleteProduct, deleteCategory, bulkDeleteProducts, bulkDeleteCategories,
        fetchLocations, updateLocationButtons,
    } = useCartaAdmin(appState);

    // ── UI State ───────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('products');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [isDeleting, setIsDeleting]   = useState(false);
    const [aiImagenProduct, setAiImagenProduct] = useState(null);
    const [syncMsg, setSyncMsg]         = useState(null);  // { type: 'success'|'error', text }
    const [isSyncingLocal, setIsSyncingLocal] = useState(false);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Filtered Lists ─────────────────────────────────────────────────────────
    const filteredProducts = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return products.filter(p => {
            const matchSearch = !q || p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q);
            const matchCat = !selectedCategoryFilter || (p.category_ids || []).includes(selectedCategoryFilter);
            return matchSearch && matchCat;
        });
    }, [products, searchQuery, selectedCategoryFilter]);

    const filteredCategories = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return categories.filter(c => !q || c.nombre?.toLowerCase().includes(q) || c.alias?.toLowerCase().includes(q));
    }, [categories, searchQuery]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSaveProduct = async (id, payload) => {
        id ? await updateProduct(id, payload) : await createProduct(payload);
        refresh();
    };
    const handleSaveCategory = async (id, payload) => {
        id ? await updateCategory(id, payload) : await createCategory(payload);
        refresh();
    };
    const handleDeleteIndividual = (type, id, name) => setConfirmDelete({ isBulk: false, type, id, name });
    const handleDeleteBulk = () => {
        const type = activeTab === 'products' ? 'products' : 'categories';
        const count = type === 'products' ? selectedProductIds.length : selectedCategoryIds.length;
        setConfirmDelete({ isBulk: true, type, count });
    };
    const executeDelete = async () => {
        setIsDeleting(true);
        try {
            if (confirmDelete.isBulk) {
                confirmDelete.type === 'products' ? await bulkDeleteProducts(selectedProductIds) : await bulkDeleteCategories(selectedCategoryIds);
                confirmDelete.type === 'products' ? setSelectedProductIds([]) : setSelectedCategoryIds([]);
            } else {
                confirmDelete.type === 'products' ? await deleteProduct(confirmDelete.id) : await deleteCategory(confirmDelete.id);
            }
            refresh(); setConfirmDelete(null);
        } catch (err) { alert(t('carta.error_delete', { message: err.message })); }
        finally { setIsDeleting(false); }
    };
    const handleCleanDb = async () => {
        if (!confirm(t('carta.clean_db_confirm'))) return;
        setIsSyncingLocal(true);
        setSyncMsg(null);
        try {
            const res = await cleanDatabaseDuplicates();
            setSyncMsg({ type: 'success', text: res?.message || '✅ Base de datos limpiada' });
            refresh();
        } catch (err) {
            setSyncMsg({ type: 'error', text: `❌ ${err.message}` });
        } finally {
            setIsSyncingLocal(false);
            setTimeout(() => setSyncMsg(null), 5000);
        }
    };

    const handleSyncWeb = async () => {
        setIsSyncingLocal(true);
        setSyncMsg(null);
        try {
            const res = await triggerPublicSync();
            setSyncMsg({ type: 'success', text: `⚡ ${res?.message || 'Carta digital actualizada'}` });
        } catch (err) {
            const detail = err?.detail || err?.message || String(err);
            setSyncMsg({ type: 'error', text: `❌ ${detail}` });
        } finally {
            setIsSyncingLocal(false);
            setTimeout(() => setSyncMsg(null), 6000);
        }
    };
    const toggleProduct = (id) => setSelectedProductIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    const toggleCategory = (id) => setSelectedCategoryIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    return (
        <div className="min-h-screen bg-light-background dark:bg-dark-background">

            {/* ── Hero Header ─────────────────────────────────────────────── */}
            <div className="relative bg-gradient-to-b from-light-surface-secondary/80 to-transparent dark:from-dark-surface/80 dark:to-transparent border-b border-light-border/50 dark:border-dark-border/50 pb-0">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-10 pb-6">
                    <div className="flex items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-8 h-8 rounded-xl bg-light-accent dark:bg-dark-accent flex items-center justify-center shadow-neon">
                                    <BookOpen className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-widest text-light-accent dark:text-dark-accent">Admin</span>
                            </div>
                            <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
                                {t('carta.title')}
                            </h1>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                {t('carta.subtitle')}
                            </p>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <button onClick={handleCleanDb} disabled={isSyncingLocal}
                                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-red-500 dark:text-red-400 hover:bg-red-500/5 text-xs font-semibold transition-all disabled:opacity-40 shadow-sm">
                                    {isSyncingLocal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    <span className="hidden sm:inline">{t('carta.clean_db')}</span>
                                </button>
                                <button onClick={handleSyncWeb} disabled={isSyncingLocal}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all disabled:opacity-40 shadow-sm ${
                                        isSyncingLocal
                                            ? 'bg-green-500/10 border-green-400/30 text-green-600 dark:text-green-400'
                                            : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:bg-green-500/5 hover:border-green-400/30 hover:text-green-600 dark:hover:text-green-400'
                                    }`}>
                                    {isSyncingLocal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-green-500" />}
                                    <span className="hidden sm:inline">{t('carta.sync_web')}</span>
                                </button>
                            </div>
                            {/* Feedback toast (inline below buttons) */}
                            {syncMsg && (
                                <div className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl ${
                                    syncMsg.type === 'success'
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                } max-w-xs text-right leading-snug`}>
                                    {syncMsg.text}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 space-y-5">

                {/* ── Toolbar: Filters + Tabs + CTA ─────────────────────────── */}
                <div className="space-y-3">
                    {/* Row 1: Tabs */}
                    <div className="overflow-x-auto pb-0.5">
                        <div className="flex items-center bg-light-surface-secondary/70 dark:bg-dark-surface-secondary/70 backdrop-blur-sm p-1 rounded-2xl gap-0.5 border border-light-border/50 dark:border-dark-border/50 w-max">
                            <SegmentedTab id="products"    active={activeTab === 'products'}    onClick={setActiveTab} icon={Package}          label={t('carta.tab_products')}    count={products.length} />
                            <SegmentedTab id="categories"  active={activeTab === 'categories'}  onClick={setActiveTab} icon={Tags}             label={t('carta.tab_categories')}  count={categories.length} />
                            <SegmentedTab id="options"     active={activeTab === 'options'}     onClick={setActiveTab} icon={Layers}           label={t('carta.tab_options')}     count={menuOptions.length} />
                            <SegmentedTab id="locations"   active={activeTab === 'locations'}   onClick={setActiveTab} icon={SlidersHorizontal} label={t('carta.tab_locations')} />
                            <SegmentedTab id="mtz-missing" active={activeTab === 'mtz-missing'} onClick={setActiveTab} icon={Database}         label="MTZ" />
                        </div>
                    </div>

                    {/* Row 2: Search + Category filter + CTA */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[140px] max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                            <input type="text" placeholder={t('carta.search')} value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent shadow-sm" />
                        </div>

                        {/* Category filter — products tab only */}
                        <AnimatePresence>
                            {activeTab === 'products' && (
                                <motion.select
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                    value={selectedCategoryFilter} onChange={e => setSelectedCategoryFilter(e.target.value)}
                                    className="py-2.5 pl-3 pr-8 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent shadow-sm appearance-none cursor-pointer">
                                    <option value="">{t('carta.all_categories')}</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </motion.select>
                            )}
                        </AnimatePresence>

                        {/* spacer */}
                        <div className="flex-1" />

                        {/* CTA */}
                        {activeTab === 'products' && (
                            <button onClick={() => setEditingProduct({})}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold shadow-neon hover:opacity-90 transition-all shrink-0">
                                <Package className="w-4 h-4" />
                                <span className="hidden sm:inline">{t('carta.new_product')}</span>
                                <span className="sm:hidden">+</span>
                            </button>
                        )}
                        {activeTab === 'categories' && (
                            <button onClick={() => setEditingCategory({})}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold shadow-neon hover:opacity-90 transition-all shrink-0">
                                <Tags className="w-4 h-4" />
                                <span className="hidden sm:inline">{t('carta.new_category')}</span>
                                <span className="sm:hidden">+</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Content ────────────────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center py-28 gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-light-accent dark:text-dark-accent" />
                                </div>
                            </div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('carta.loading')}</p>
                        </motion.div>
                    ) : (
                        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                            {activeTab === 'products' && (
                                <ProductsTable products={filteredProducts} categories={categories}
                                    menuOptions={menuOptions}
                                    selectedIds={selectedProductIds} onToggle={toggleProduct} onToggleAll={setSelectedProductIds}
                                    onEdit={setEditingProduct} onDelete={(id, name) => handleDeleteIndividual('products', id, name)}
                                    onAIImagen={setAiImagenProduct}
                                />
                            )}
                            {activeTab === 'categories' && (
                                <CategoriesTable categories={filteredCategories}
                                    products={products}
                                    selectedIds={selectedCategoryIds} onToggle={toggleCategory} onToggleAll={setSelectedCategoryIds}
                                    onEdit={setEditingCategory} onDelete={(id, name) => handleDeleteIndividual('categories', id, name)} />
                            )}
                            {activeTab === 'locations' && (
                                <LocationButtonsManager locations={locations} fetchLocations={fetchLocations}
                                    updateButtons={updateLocationButtons} categories={categories} isLoading={isLoading} />
                            )}
                            {activeTab === 'mtz-missing' && (
                                <MtzMissingTable
                                    appState={appState}
                                    onCreateProduct={(prefill) => setEditingProduct(prefill)}
                                />
                            )}
                            {activeTab === 'options' && (
                                <MenuOptionsManager
                                    menuOptions={menuOptions}
                                    products={products}
                                    onRefresh={refresh}
                                    token={appState?.token}
                                    account={appState?.account}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Floating Bulk Actions */}
            <BulkActionsBar activeTab={activeTab} selectedProductIds={selectedProductIds} selectedCategoryIds={selectedCategoryIds}
                onClear={() => activeTab === 'products' ? setSelectedProductIds([]) : setSelectedCategoryIds([])}
                onDelete={handleDeleteBulk} />

            {/* Modals */}
            <AnimatePresence>
                {editingProduct !== null && (
                    <ProductModal product={editingProduct} categories={categories} menuOptions={menuOptions}
                        products={filteredProducts}
                        onClose={() => setEditingProduct(null)} onSave={handleSaveProduct} uploadImage={uploadProductImage}
                        token={appState?.token} account={appState?.account}
                        onOpenAurora={(prod) => { setEditingProduct(null); setAiImagenProduct(prod); }} />
                )}
                {editingCategory !== null && (
                    <CategoryModal category={editingCategory}
                        products={products}
                        onClose={() => setEditingCategory(null)} onSave={handleSaveCategory} />
                )}
                {confirmDelete && (
                    <DeleteConfirmModal confirmDelete={confirmDelete} isDeleting={isDeleting}
                        onCancel={() => setConfirmDelete(null)} onConfirm={executeDelete} />
                )}
                {aiImagenProduct && (
                    <AIImagenModal
                        product={aiImagenProduct}
                        categories={categories}
                        token={appState?.token}
                        account={appState?.account}
                        onClose={() => { setAiImagenProduct(null); refresh(); }}
                        onUpdated={(productId, fields) => {
                            // Actualiza reactivamente el array en memoria SIN re-fetch
                            if (fields) patchProduct(productId, fields);
                            else refresh(); // fallback: re-fetch si no hay fields
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminCarta;

export const pageMetadata = {
    path: '/app/admin/carta',
    label: 'carta.label',
    category: 'admin.category',
    minRoleLevel: 3,
    maxRoleLevel: 5,
    order: 4,
    locations: ['sidebar'],
    description: 'carta.description',
    icon: 'FaBook',
};
