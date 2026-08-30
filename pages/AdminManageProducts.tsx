
import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { useAppContext } from '../context/AppContext';
import { CategorySection } from '../constants';
import { apiFetch, ApiError } from '../api';
import ConfirmationModal from '../components/ConfirmationModal';
import AdminVariantManager from '../components/AdminVariantManager'; // Add this import

const PRODUCTS_PER_PAGE = 5;

const AdminManageProducts: React.FC = () => {
  const context = useAppContext();
  const { categories, products, categoryHierarchy, addProduct, updateProduct, deleteProduct, getFormattedPrice, token } = context;
  const showToast = context.showToast;

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Add Product Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductPrice, setNewProductPrice] = useState<string>(''); // Keep as string for input control
  const [newProductCategory, setNewProductCategory] = useState<string>('');
  const [newProductSubCategory, setNewProductSubCategory] = useState<string>('');
  const [newProductImagePreviews, setNewProductImagePreviews] = useState<string[]>([]); // Uploaded image URLs
  const [isUploadingNewImages, setIsUploadingNewImages] = useState(false);
  const [newProductVideoUrls, setNewProductVideoUrls] = useState<string[]>([]);
  const [isUploadingNewVideo, setIsUploadingNewVideo] = useState(false);
  const [newProductStock, setNewProductStock] = useState<string>('');
  const [newProductDiscount, setNewProductDiscount] = useState<string>('0');
  const [newProductFeatured, setNewProductFeatured] = useState(false);
  const [newProductVariants, setNewProductVariants] = useState<ProductVariant[]>([]);
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});

  // Edit Product Modal State
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState('');
  const [editingProductDescription, setEditingProductDescription] = useState('');
  const [editingProductPrice, setEditingProductPrice] = useState<string>(''); // Keep as string for input control
  const [editingProductCategory, setEditingProductCategory] = useState<string>('');
  const [editingProductSubCategory, setEditingProductSubCategory] = useState<string>('');
  const [editingProductImagePreviews, setEditingProductImagePreviews] = useState<string[]>([]); // Existing + newly uploaded image URLs
  const [isUploadingEditImages, setIsUploadingEditImages] = useState(false);
  const [editingProductVideoUrls, setEditingProductVideoUrls] = useState<string[]>([]);
  const [isUploadingEditVideo, setIsUploadingEditVideo] = useState(false);
  const [editingProductStock, setEditingProductStock] = useState<string>('');
  const [editingProductDiscount, setEditingProductDiscount] = useState<string>('0');
  const [editingProductFeatured, setEditingProductFeatured] = useState(false);
  const [editingProductVariants, setEditingProductVariants] = useState<ProductVariant[]>([]);
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // Delete Confirmation Modal State
  const [showDeleteProductConfirm, setShowDeleteProductConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);


  const filteredProducts = useMemo(() => {
    let prods = [...products];
    if (activeCategory) {
      prods = prods.filter(p => p.category === activeCategory);
    }
    return prods;
  }, [activeCategory, products]);

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return (
        <span className="inline-flex items-center gap-2 text-red-600 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Out of stock
        </span>
      );
    } else if (stock <= 10) {
      return (
        <span className="inline-flex items-center gap-2 text-orange-600 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Low stock ({stock})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-2 text-emerald-600 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> In stock ({stock})
        </span>
      );
    }
  };

  // Generic image upload handler for both add/edit - uploads real files, stores back the URLs
  const handleImageFileChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    setPreviews: React.Dispatch<React.SetStateAction<string[]>>,
    setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    setIsUploading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ''; // allow re-selecting the same file later
    if (files.length === 0) return;

    setErrors(prev => ({ ...prev, images: '' }));
    setIsUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const { url } = await apiFetch<{ url: string }>('/uploads', { method: 'POST', body: formData }, token);
        return url;
      }));
      setPreviews(prev => [...prev, ...uploadedUrls]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not upload one or more images.', 'error');
    } finally {
      setIsUploading(false);
    }
  }, [token, showToast]);

  // Generic video upload handler for both add/edit - mirrors handleImageFileChange, just for videos.
  const handleVideoFileChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    setVideoUrls: React.Dispatch<React.SetStateAction<string[]>>,
    setIsUploading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ''; // allow re-selecting the same file later
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const { url } = await apiFetch<{ url: string }>('/uploads', { method: 'POST', body: formData }, token);
        return url;
      }));
      setVideoUrls(prev => [...prev, ...uploadedUrls]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not upload one or more videos.', 'error');
    } finally {
      setIsUploading(false);
    }
  }, [token, showToast]);

  // Generic image removal handler for both add/edit
  const handleRemoveImage = useCallback((
    indexToRemove: number,
    setPreviews: React.Dispatch<React.SetStateAction<string[]>>,
    setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    setPreviews(prev => {
      const updated = prev.filter((_, index) => index !== indexToRemove);
      if (updated.length === 0) {
        setErrors(errPrev => ({ ...errPrev, images: 'At least one product image is required.' }));
      }
      return updated;
    });
  }, []);

  // Video removal (no validation needed - videos are always optional)
  const handleRemoveVideo = useCallback((
    indexToRemove: number,
    setVideoUrls: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setVideoUrls(prev => prev.filter((_, index) => index !== indexToRemove));
  }, []);


  // --- Add Product Functions ---

  const handleAddProductClick = () => {
    setNewProductName('');
    setNewProductDescription('');
    setNewProductPrice('');
    setNewProductCategory('');
    setNewProductSubCategory('');
    setNewProductImagePreviews([]);
    setNewProductVideoUrls([]);
    setNewProductStock('');
    setNewProductDiscount('0');
    setNewProductFeatured(false);
    setNewProductVariants([]);
    setAddFormErrors({});
    setShowAddProductModal(true);
  };

  const validateAddForm = () => {
    const errors: Record<string, string> = {};
    if (!newProductName.trim()) errors.name = 'Product name is required.';
    if (!newProductDescription.trim()) errors.description = 'Product description is required.';
    if (!newProductCategory) errors.category = 'Category is required.';
    if (!newProductSubCategory) errors.subCategory = 'Sub-category is required.';
    if (newProductImagePreviews.length === 0) errors.images = 'At least one product image is required.';
    // Validate price as a number
    const priceNum = parseFloat(newProductPrice);
    if (isNaN(priceNum) || priceNum <= 0) errors.price = 'Valid price is required.';
    // Validate stock as an integer
    const stockNum = parseInt(newProductStock);
    if (isNaN(stockNum) || stockNum < 0) errors.stock = 'Valid stock quantity is required.';
    
    // Validate discount (0-100)
    const discountNum = parseFloat(newProductDiscount);
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) errors.discount = 'Discount must be between 0 and 100.';

    setAddFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveNewProduct = async () => {
    if (!validateAddForm()) {
      showToast('Please correct the form errors first.', 'error');
      return;
    }

    const newProduct: Omit<Product, 'id' | 'rating' | 'reviews'> = {
      name: newProductName.trim(),
      description: newProductDescription.trim(),
      price: parseFloat(newProductPrice), // Store as USD base price
      discount: parseFloat(newProductDiscount),
      category: newProductCategory,
      subCategory: newProductSubCategory,
      images: newProductImagePreviews, // Uploaded image URLs
      videoUrls: newProductVideoUrls,
      stock: parseInt(newProductStock),
      featured: newProductFeatured,
      variants: newProductVariants,
    };

    const success = await addProduct(newProduct);
    if (success) setShowAddProductModal(false);
  };

  const availableSubCategoriesForAdd = useMemo(() => {
    if (!newProductCategory) return [];
    return categoryHierarchy[newProductCategory]?.flatMap(section => section.items) || [];
  }, [newProductCategory, categoryHierarchy]);


  // --- Edit Product Functions ---
  const handleEditProductClick = (product: Product) => {
    setEditingProductId(product.id);
    setEditingProductName(product.name);
    setEditingProductDescription(product.description);
    setEditingProductPrice(product.price.toString()); // Display USD base price in input
    setEditingProductDiscount((product.discount || 0).toString());
    setEditingProductCategory(product.category);
    setEditingProductSubCategory(product.subCategory);
    setEditingProductImagePreviews(product.images); // Pre-fill with existing images
    setEditingProductVideoUrls(product.videoUrls ?? []);
    setEditingProductStock(product.stock.toString());
    setEditingProductFeatured(!!product.featured); // Ensure boolean
    setEditingProductVariants(product.variants || []);
    setEditFormErrors({});
    setShowEditProductModal(true);
  };

  const validateEditForm = () => {
    const errors: Record<string, string> = {};
    if (!editingProductName.trim()) errors.name = 'Product name is required.';
    if (!editingProductDescription.trim()) errors.description = 'Product description is required.';
    if (!editingProductCategory) errors.category = 'Category is required.';
    if (!editingProductSubCategory) errors.subCategory = 'Sub-category is required.';
    if (editingProductImagePreviews.length === 0) errors.images = 'At least one product image is required.';
    // Validate price as a number
    const priceNum = parseFloat(editingProductPrice);
    if (isNaN(priceNum) || priceNum <= 0) errors.price = 'Valid price is required.';
    // Validate stock as an integer
    const stockNum = parseInt(editingProductStock);
    if (isNaN(stockNum) || stockNum < 0) errors.stock = 'Valid stock quantity is required.';
    
    // Validate discount (0-100)
    const discountNum = parseFloat(editingProductDiscount);
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) errors.discount = 'Discount must be between 0 and 100.';

    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEditedProduct = async () => {
    if (!validateEditForm()) {
      showToast('Please correct the form errors first.', 'error');
      return;
    }

    if (!editingProductId) {
      showToast('No product selected.', 'error');
      return;
    }

    const updatedProduct: Product = {
      id: editingProductId,
      name: editingProductName.trim(),
      description: editingProductDescription.trim(),
      price: parseFloat(editingProductPrice), // Store as USD base price
      discount: parseFloat(editingProductDiscount),
      category: editingProductCategory,
      subCategory: editingProductSubCategory,
      images: editingProductImagePreviews, // This array already contains existing + new images
      videoUrls: editingProductVideoUrls,
      stock: parseInt(editingProductStock),
      featured: editingProductFeatured,
      variants: editingProductVariants,
      rating: products.find(p => p.id === editingProductId)?.rating || 4.5, // Preserve existing rating
      reviews: products.find(p => p.id === editingProductId)?.reviews || 0, // Preserve existing reviews
    };

    const success = await updateProduct(updatedProduct);
    if (success) setShowEditProductModal(false);
  };

  const availableSubCategoriesForEdit = useMemo(() => {
    if (!editingProductCategory) return [];
    return categoryHierarchy[editingProductCategory]?.flatMap(section => section.items) || [];
  }, [editingProductCategory, categoryHierarchy]);


  // --- Delete Product Functions ---
  const handleDeleteProductClick = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteProductConfirm(true);
  };

  const confirmDeleteProduct = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.id);
      setShowDeleteProductConfirm(false);
      setProductToDelete(null);
    }
  };


  return (
    <>
      {/* Page Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-wrap justify-between items-end gap-3 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">Manage Products</h1>
            <p className="text-slate-500 dark:text-emerald-300 text-sm mt-1">Add, edit, and manage your product inventory.</p>
          </div>
          <button
            onClick={handleAddProductClick}
            className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
          >
            <Plus size={20} /> Add New Product
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        {/* Category Filters */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setActiveCategory(null); setCurrentPage(1); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${!activeCategory ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            All Categories
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => { setActiveCategory(category); setCurrentPage(1); }}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeCategory === category ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Products Table */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[100px]">Image</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Product Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Category</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sub-category</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Price</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Colors</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sizes</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Stock</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors duration-300">
                {paginatedProducts.length > 0 ? paginatedProducts.map(product => {
                  const uniqueColors = Array.from(new Set((product.variants || []).map(v => v.color))).filter(c => c);
                  const uniqueSizes = Array.from(new Set((product.variants || []).map(v => v.size))).filter(s => s);
                  return (
                  <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-colors">
                    <td className="px-6 py-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-100 dark:border-slate-800 flex items-center justify-center transition-colors">
                        {product.images && product.images.length > 0 ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <ImageIcon size={24} className="text-slate-400 dark:text-slate-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="font-semibold text-slate-800 dark:text-emerald-50 line-clamp-2 min-h-[2.5rem]">{product.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">SKU: {product.id.toUpperCase()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-emerald-200 transition-colors">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-emerald-200">{product.subCategory}</td>
                    <td className="px-6 py-4 text-base font-bold text-slate-900 dark:text-emerald-50">
                      <div className="flex flex-col">
                        <span>{getFormattedPrice(product.price * (1 - (product.discount || 0) / 100))}</span>
                        {(product.discount || 0) > 0 && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 line-through">{getFormattedPrice(product.price)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-emerald-200">{uniqueColors.join(', ') || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-emerald-200">{uniqueSizes.join(', ') || '-'}</td>
                    <td className="px-6 py-4">{getStockStatus(product.stock)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => handleEditProductClick(product)}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          aria-label={`Edit ${product.name}`}
                          title={`Edit ${product.name}`}
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProductClick(product)}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          aria-label={`Delete ${product.name}`}
                          title={`Delete ${product.name}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-500 dark:text-emerald-300 text-lg">No products found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredProducts.length > 0 && (
            <div className="flex items-center justify-between p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
              <span className="text-sm text-slate-600 dark:text-emerald-300">
                {`Showing ${Math.min(filteredProducts.length, (currentPage - 1) * PRODUCTS_PER_PAGE + 1)}-${Math.min(filteredProducts.length, currentPage * PRODUCTS_PER_PAGE)} of ${filteredProducts.length} products`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-semibold ${currentPage === page ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add New Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 sm:p-8 w-full max-w-2xl shadow-xl border border-slate-100 dark:border-slate-800 relative">
            <h3 className="text-2xl font-black text-slate-900 dark:text-emerald-50 mb-6">Add New Product</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="col-span-full">
                <label htmlFor="productName" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Product Name</label>
                <input
                  id="productName"
                  type="text"
                  placeholder="e.g. Gaming Mouse"
                  value={newProductName}
                  onChange={(e) => { setNewProductName(e.target.value); setAddFormErrors(prev => ({ ...prev, name: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {addFormErrors.name && <p className="text-red-500 text-xs mt-1">{addFormErrors.name}</p>}
              </div>

              <div className="col-span-full">
                <label htmlFor="productDescription" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Description</label>
                <textarea
                  id="productDescription"
                  placeholder="A detailed description of the product."
                  value={newProductDescription}
                  onChange={(e) => { setNewProductDescription(e.target.value); setAddFormErrors(prev => ({ ...prev, description: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm h-24 resize-y text-slate-900 dark:text-emerald-100"
                />
                {addFormErrors.description && <p className="text-red-500 text-xs mt-1">{addFormErrors.description}</p>}
              </div>

              <div>
                <label htmlFor="productPrice" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Price (RWF)</label>
                <input
                  id="productPrice"
                  type="text" // Changed to text to avoid browser locale issues with type="number"
                  inputMode="numeric" // Suggest numeric keyboard on mobile
                  pattern="[0-9]*[.]?[0-9]*" // Pattern to allow decimals
                  placeholder="0.00"
                  value={newProductPrice}
                  onChange={(e) => { setNewProductPrice(e.target.value); setAddFormErrors(prev => ({ ...prev, price: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {addFormErrors.price && <p className="text-red-500 text-xs mt-1">{addFormErrors.price}</p>}
              </div>

              <div>
                <label htmlFor="productStock" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Stock Quantity</label>
                <input
                  id="productStock"
                  type="number"
                  step="1"
                  placeholder="0"
                  value={newProductStock}
                  onChange={(e) => { setNewProductStock(e.target.value); setAddFormErrors(prev => ({ ...prev, stock: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {addFormErrors.stock && <p className="text-red-500 text-xs mt-1">{addFormErrors.stock}</p>}
              </div>

              <div>
                <label htmlFor="productDiscount" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Discount (%)</label>
                <input
                  id="productDiscount"
                  type="number"
                  placeholder="0"
                  value={newProductDiscount}
                  onChange={(e) => { setNewProductDiscount(e.target.value); setAddFormErrors(prev => ({ ...prev, discount: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {addFormErrors.discount && <p className="text-red-500 text-xs mt-1">{addFormErrors.discount}</p>}
              </div>

              <div>
                <label htmlFor="productCategory" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Category</label>
                <select
                  id="productCategory"
                  value={newProductCategory}
                  onChange={(e) => {
                    setNewProductCategory(e.target.value);
                    setNewProductSubCategory(''); // Reset sub-category when category changes
                    setAddFormErrors(prev => ({ ...prev, category: '' }));
                  }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {addFormErrors.category && <p className="text-red-500 text-xs mt-1">{addFormErrors.category}</p>}
              </div>

              <div>
                <label htmlFor="productSubCategory" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Sub-category</label>
                <select
                  id="productSubCategory"
                  value={newProductSubCategory}
                  onChange={(e) => { setNewProductSubCategory(e.target.value); setAddFormErrors(prev => ({ ...prev, subCategory: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                  disabled={!newProductCategory}
                >
                  <option value="">Select sub-category</option>
                  {availableSubCategoriesForAdd.map(subCat => (
                    <option key={subCat} value={subCat}>{subCat}</option>
                  ))}
                </select>
                {addFormErrors.subCategory && <p className="text-red-500 text-xs mt-1">{addFormErrors.subCategory}</p>}
              </div>

              <div className="col-span-full">
                <label htmlFor="productImages" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Product Images</label>
                <input
                  id="productImages"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageFileChange(e, setNewProductImagePreviews, setAddFormErrors, setIsUploadingNewImages)}
                  disabled={isUploadingNewImages}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 dark:file:bg-emerald-900 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-800 disabled:opacity-60"
                />
                {isUploadingNewImages && <p className="text-emerald-600 text-xs mt-1">Uploading...</p>}
                {addFormErrors.images && <p className="text-red-500 text-xs mt-1">{addFormErrors.images}</p>}

                {newProductImagePreviews.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {newProductImagePreviews.map((preview, index) => (
                      <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shadow-sm group">
                        <img src={preview} alt={`Product Preview ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index, setNewProductImagePreviews, setAddFormErrors)}
                          className="absolute top-1 right-1 bg-white/70 backdrop-blur-sm rounded-full p-0.5 text-slate-500 hover:text-rose-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                          title="Remove image"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-full">
                <label htmlFor="productVideo" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Product Videos (Optional)</label>
                <input
                  id="productVideo"
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => handleVideoFileChange(e, setNewProductVideoUrls, setIsUploadingNewVideo)}
                  disabled={isUploadingNewVideo}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 dark:file:bg-emerald-900 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-800 disabled:opacity-60"
                />
                {isUploadingNewVideo && <p className="text-emerald-600 text-xs mt-1">Uploading...</p>}

                {newProductVideoUrls.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {newProductVideoUrls.map((url, index) => (
                      <div key={index} className="relative w-40 rounded-lg overflow-hidden border border-slate-200 shadow-sm group">
                        <video src={url} controls className="w-full h-24 bg-black object-contain" />
                        <button
                          type="button"
                          onClick={() => handleRemoveVideo(index, setNewProductVideoUrls)}
                          className="absolute top-1 right-1 bg-white/70 backdrop-blur-sm rounded-full p-0.5 text-slate-500 hover:text-rose-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                          title="Remove video"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-full flex items-center gap-3 mt-2">
                <input
                  id="productFeatured"
                  type="checkbox"
                  checked={newProductFeatured}
                  onChange={(e) => setNewProductFeatured(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-emerald-800 dark:text-emerald-500 focus:ring-emerald-700 dark:focus:ring-emerald-600 accent-emerald-800"
                />
                <label htmlFor="productFeatured" className="text-sm font-semibold text-slate-700 dark:text-emerald-300">Featured Product</label>
              </div>

              <div className="col-span-full">
                <AdminVariantManager variants={newProductVariants} onChange={setNewProductVariants} />
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowAddProductModal(false)}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewProduct}
                className="px-6 py-3 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
              >
                Add Product
              </button>
            </div>
            <button
              onClick={() => setShowAddProductModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditProductModal && editingProductId && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 sm:p-8 w-full max-w-2xl shadow-xl border border-slate-100 dark:border-slate-800 relative">
            <h3 className="text-2xl font-black text-slate-900 dark:text-emerald-50 mb-6">Edit Product: {editingProductName}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="col-span-full">
                <label htmlFor="editProductName" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Product Name</label>
                <input
                  id="editProductName"
                  type="text"
                  placeholder="e.g. Gaming Mouse"
                  value={editingProductName}
                  onChange={(e) => { setEditingProductName(e.target.value); setEditFormErrors(prev => ({ ...prev, name: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {editFormErrors.name && <p className="text-red-500 text-xs mt-1">{editFormErrors.name}</p>}
              </div>

              <div className="col-span-full">
                <label htmlFor="editProductDescription" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Description</label>
                <textarea
                  id="editProductDescription"
                  placeholder="A detailed description of the product."
                  value={editingProductDescription}
                  onChange={(e) => { setEditingProductDescription(e.target.value); setEditFormErrors(prev => ({ ...prev, description: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm h-24 resize-y text-slate-900 dark:text-emerald-100"
                />
                {editFormErrors.description && <p className="text-red-500 text-xs mt-1">{editFormErrors.description}</p>}
              </div>

              <div>
                <label htmlFor="editProductPrice" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Price (RWF)</label>
                <input
                  id="editProductPrice"
                  type="text" // Changed to text
                  inputMode="numeric"
                  pattern="[0-9]*[.]?[0-9]*"
                  placeholder="0.00"
                  value={editingProductPrice}
                  onChange={(e) => { setEditingProductPrice(e.target.value); setEditFormErrors(prev => ({ ...prev, price: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {editFormErrors.price && <p className="text-red-500 text-xs mt-1">{editFormErrors.price}</p>}
              </div>

              <div>
                <label htmlFor="editProductStock" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Stock Quantity</label>
                <input
                  id="editProductStock"
                  type="number"
                  step="1"
                  placeholder="0"
                  value={editingProductStock}
                  onChange={(e) => { setEditingProductStock(e.target.value); setEditFormErrors(prev => ({ ...prev, stock: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {editFormErrors.stock && <p className="text-red-500 text-xs mt-1">{editFormErrors.stock}</p>}
              </div>

              <div>
                <label htmlFor="editProductDiscount" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Discount (%)</label>
                <input
                  id="editProductDiscount"
                  type="number"
                  placeholder="0"
                  value={editingProductDiscount}
                  onChange={(e) => { setEditingProductDiscount(e.target.value); setEditFormErrors(prev => ({ ...prev, discount: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {editFormErrors.discount && <p className="text-red-500 text-xs mt-1">{editFormErrors.discount}</p>}
              </div>

              <div>
                <label htmlFor="editProductCategory" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Category</label>
                <select
                  id="editProductCategory"
                  value={editingProductCategory}
                  onChange={(e) => {
                    setEditingProductCategory(e.target.value);
                    setEditingProductSubCategory('');
                    setEditFormErrors(prev => ({ ...prev, category: '' }));
                  }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {editFormErrors.category && <p className="text-red-500 text-xs mt-1">{editFormErrors.category}</p>}
              </div>

              <div>
                <label htmlFor="editProductSubCategory" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Sub-category</label>
                <select
                  id="editProductSubCategory"
                  value={editingProductSubCategory}
                  onChange={(e) => { setEditingProductSubCategory(e.target.value); setEditFormErrors(prev => ({ ...prev, subCategory: '' })); }}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                  disabled={!editingProductCategory}
                >
                  <option value="">Select sub-category</option>
                  {availableSubCategoriesForEdit.map(subCat => (
                    <option key={subCat} value={subCat}>{subCat}</option>
                  ))}
                </select>
                {editFormErrors.subCategory && <p className="text-red-500 text-xs mt-1">{editFormErrors.subCategory}</p>}
              </div>

              <div className="col-span-full">
                <label htmlFor="editProductImages" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Product Images</label>
                <input
                  id="editProductImages"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageFileChange(e, setEditingProductImagePreviews, setEditFormErrors, setIsUploadingEditImages)}
                  disabled={isUploadingEditImages}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 dark:file:bg-emerald-900 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-800 disabled:opacity-60"
                />
                {isUploadingEditImages && <p className="text-emerald-600 text-xs mt-1">Uploading...</p>}
                {editFormErrors.images && <p className="text-red-500 text-xs mt-1">{editFormErrors.images}</p>}

                {editingProductImagePreviews.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {editingProductImagePreviews.map((preview, index) => (
                      <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shadow-sm group">
                        <img src={preview} alt={`Product Preview ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index, setEditingProductImagePreviews, setEditFormErrors)}
                          className="absolute top-1 right-1 bg-white/70 backdrop-blur-sm rounded-full p-0.5 text-slate-500 hover:text-rose-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                          title="Remove image"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-full">
                <label htmlFor="editProductVideo" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Product Videos (Optional)</label>
                <input
                  id="editProductVideo"
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => handleVideoFileChange(e, setEditingProductVideoUrls, setIsUploadingEditVideo)}
                  disabled={isUploadingEditVideo}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 dark:file:bg-emerald-900 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-800 disabled:opacity-60"
                />
                {isUploadingEditVideo && <p className="text-emerald-600 text-xs mt-1">Uploading...</p>}

                {editingProductVideoUrls.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {editingProductVideoUrls.map((url, index) => (
                      <div key={index} className="relative w-40 rounded-lg overflow-hidden border border-slate-200 shadow-sm group">
                        <video src={url} controls className="w-full h-24 bg-black object-contain" />
                        <button
                          type="button"
                          onClick={() => handleRemoveVideo(index, setEditingProductVideoUrls)}
                          className="absolute top-1 right-1 bg-white/70 backdrop-blur-sm rounded-full p-0.5 text-slate-500 hover:text-rose-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                          title="Remove video"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-full flex items-center gap-3 mt-2">
                <input
                  id="editProductFeatured"
                  type="checkbox"
                  checked={editingProductFeatured}
                  onChange={(e) => setEditingProductFeatured(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-emerald-800 dark:text-emerald-500 focus:ring-emerald-700 dark:focus:ring-emerald-600 accent-emerald-800"
                />
                <label htmlFor="editProductFeatured" className="text-sm font-semibold text-slate-700 dark:text-emerald-300">Featured Product</label>
              </div>

              <div className="col-span-full">
                <AdminVariantManager variants={editingProductVariants} onChange={setEditingProductVariants} />
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowEditProductModal(false)}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedProduct}
                className="px-6 py-3 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
              >
                Save Changes
              </button>
            </div>
            <button
              onClick={() => setShowEditProductModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteProductConfirm}
        onClose={() => setShowDeleteProductConfirm(false)}
        onConfirm={confirmDeleteProduct}
        title="Delete Product?"
        message={`Are you sure you want to delete the product "${productToDelete?.name}"? This action cannot be undone.`}
        confirmButtonText="Delete Product"
      />
    </>
  );
};

export default AdminManageProducts;
