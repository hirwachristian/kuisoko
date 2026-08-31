
import React, { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, X } from 'lucide-react'; // Import icons
import { useAppContext } from '../context/AppContext';
import { CategorySection } from '../constants'; // Import CategorySection interface
import ConfirmationModal from '../components/ConfirmationModal'; // Import ConfirmationModal

const AdminManageCategories: React.FC = () => {
  const { 
    categories, 
    categoryHierarchy, 
    addCategory, 
    updateCategoryName, 
    deleteCategory, 
    addCategorySection, 
    updateCategorySection, 
    deleteCategorySection,
    // Removed translate
  } = useAppContext();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Modals state
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryNameError, setCategoryNameError] = useState('');

  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [editingCategoryOldName, setEditingCategoryOldName] = useState('');
  const [editingCategoryNewName, setEditingCategoryNewName] = useState('');
  const [editingCategoryError, setEditingCategoryError] = useState('');

  const [showAddSubCategorySectionModal, setShowAddSubCategorySectionModal] = useState(false);
  const [currentCategoryForSub, setCurrentCategoryForSub] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionItems, setNewSectionItems] = useState(''); // Comma separated string
  const [newSectionError, setNewSectionError] = useState('');

  const [showEditSubCategorySectionModal, setShowEditSubCategorySectionModal] = useState(false);
  const [editingSubCategoryCategoryName, setEditingSubCategoryCategoryName] = useState('');
  const [editingSubCategoryOldSectionTitle, setEditingSubCategoryOldSectionTitle] = useState('');
  const [editingSubCategorySectionTitle, setEditingSubCategorySectionTitle] = useState('');
  const [editingSubCategorySectionItems, setEditingSubCategorySectionItems] = useState('');
  const [editingSubCategoryError, setEditingSubCategoryError] = useState('');

  // Delete Confirmation Modals
  const [showDeleteCategoryConfirm, setShowDeleteCategoryConfirm] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState('');

  const [showDeleteSectionConfirm, setShowDeleteSectionConfirm] = useState(false);
  const [categoryForSectionToDelete, setCategoryForSectionToDelete] = useState('');
  const [sectionToDelete, setSectionToDelete] = useState('');


  // --- Category Handlers ---
  const handleAddCategoryClick = () => {
    setNewCategoryName('');
    setCategoryNameError('');
    setShowAddCategoryModal(true);
  };

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryNameError('Category name cannot be empty.');
      return;
    }
    if (categories.some(cat => cat.toLowerCase() === newCategoryName.toLowerCase())) {
      setCategoryNameError(`Category "${newCategoryName}" already exists.`);
      return;
    }
    const success = await addCategory(newCategoryName.trim());
    if (success) setShowAddCategoryModal(false);
  };

  const handleEditCategoryClick = (category: string) => {
    setEditingCategoryOldName(category);
    setEditingCategoryNewName(category);
    setEditingCategoryError('');
    setShowEditCategoryModal(true);
  };

  const handleSaveEditedCategory = async () => {
    if (!editingCategoryNewName.trim()) {
      setEditingCategoryError('Category name cannot be empty.');
      return;
    }
    if (editingCategoryNewName.toLowerCase() !== editingCategoryOldName.toLowerCase() &&
        categories.some(cat => cat.toLowerCase() === editingCategoryNewName.toLowerCase())) {
      setEditingCategoryError(`Category "${editingCategoryNewName}" already exists.`);
      return;
    }
    const success = await updateCategoryName(editingCategoryOldName, editingCategoryNewName.trim());
    if (success) setShowEditCategoryModal(false);
  };

  const handleDeleteCategoryClick = (category: string) => {
    setCategoryToDelete(category);
    setShowDeleteCategoryConfirm(true);
  };

  const confirmDeleteCategory = async () => {
    await deleteCategory(categoryToDelete);
    setShowDeleteCategoryConfirm(false);
    setCategoryToDelete('');
  };

  // --- Sub-Category Section Handlers ---
  const handleAddSubCategorySectionClick = (categoryName: string) => {
    setCurrentCategoryForSub(categoryName);
    setNewSectionTitle('');
    setNewSectionItems('');
    setNewSectionError('');
    setShowAddSubCategorySectionModal(true);
  };

  const handleSaveNewSubCategorySection = async () => {
    if (!newSectionTitle.trim()) {
      setNewSectionError('Section title cannot be empty.');
      return;
    }
    if (categoryHierarchy[currentCategoryForSub]?.some(s => s.title.toLowerCase() === newSectionTitle.toLowerCase())) {
      setNewSectionError(`Section "${newSectionTitle}" already exists in category "${currentCategoryForSub}".`);
      return;
    }

    const itemsArray = newSectionItems.split(',').map(item => item.trim()).filter(item => item);
    const success = await addCategorySection(currentCategoryForSub, newSectionTitle.trim(), itemsArray);
    if (success) setShowAddSubCategorySectionModal(false);
  };

  const handleEditSubCategorySectionClick = (categoryName: string, section: CategorySection) => {
    setEditingSubCategoryCategoryName(categoryName);
    setEditingSubCategoryOldSectionTitle(section.title);
    setEditingSubCategorySectionTitle(section.title);
    setEditingSubCategorySectionItems(section.items.join(', '));
    setEditingSubCategoryError('');
    setShowEditSubCategorySectionModal(true);
  };

  const handleSaveEditedSubCategorySection = async () => {
    if (!editingSubCategorySectionTitle.trim()) {
      setEditingSubCategoryError('Section title cannot be empty.');
      return;
    }

    // Check for duplicate title if it changed
    if (editingSubCategorySectionTitle.toLowerCase() !== editingSubCategoryOldSectionTitle.toLowerCase() &&
        categoryHierarchy[editingSubCategoryCategoryName]?.some(s => s.title.toLowerCase() === editingSubCategorySectionTitle.toLowerCase())) {
      setEditingSubCategoryError(`Section "${editingSubCategorySectionTitle}" already exists in category "${editingSubCategoryCategoryName}".`);
      return;
    }

    const itemsArray = editingSubCategorySectionItems.split(',').map(item => item.trim()).filter(item => item);
    const success = await updateCategorySection(
      editingSubCategoryCategoryName,
      editingSubCategoryOldSectionTitle,
      { title: editingSubCategorySectionTitle.trim(), items: itemsArray }
    );
    if (success) setShowEditSubCategorySectionModal(false);
  };

  const handleDeleteSubCategorySectionClick = (categoryName: string, sectionTitle: string) => {
    setCategoryForSectionToDelete(categoryName);
    setSectionToDelete(sectionTitle);
    setShowDeleteSectionConfirm(true);
  };

  const confirmDeleteSubCategorySection = async () => {
    await deleteCategorySection(categoryForSectionToDelete, sectionToDelete);
    setShowDeleteSectionConfirm(false);
    setCategoryForSectionToDelete('');
    setSectionToDelete('');
  };

  const toggleCategoryExpansion = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  return (
    <>
      {/* Page Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-wrap justify-between items-end gap-3 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">Manage Categories</h1>
            <p className="text-slate-500 dark:text-emerald-300 text-xs sm:text-sm mt-1">Add, edit, and organize your product categories.</p>
          </div>
          <button
            onClick={handleAddCategoryClick}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
          >
            <Plus size={18} className="sm:w-5 sm:h-5" /> Add Category
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 sm:gap-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        {/* Categories List Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-1/3 whitespace-nowrap">Category Name</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-1/3 whitespace-nowrap">Sub-categories</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right w-1/3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors duration-300">
                {categories.length > 0 ? categories.map((category) => (
                  <React.Fragment key={category}>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button
                            onClick={() => toggleCategoryExpansion(category)}
                            aria-expanded={expandedCategories[category]}
                            aria-controls={`subcategories-${category}`}
                            className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-800"
                            title={expandedCategories[category] ? "Collapse sub-categories" : "Expand sub-categories"}
                          >
                            {expandedCategories[category] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <p className="font-semibold text-slate-800 dark:text-emerald-50">{category}</p>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-emerald-200">
                        {/* Ensure categoryHierarchy[category] is an array */}
                        {(categoryHierarchy[category] || []).length > 0
                          ? `${(categoryHierarchy[category] || []).length} Sections`
                          : "No sections"}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                        <div className="flex items-center justify-end gap-2 sm:gap-3">
                          <button
                            onClick={() => handleEditCategoryClick(category)}
                            className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            aria-label={`Edit ${category}`}
                            title={`Edit ${category}`}
                          >
                            <Pencil size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategoryClick(category)}
                            className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            aria-label={`Delete ${category}`}
                            title={`Delete ${category}`}
                          >
                            <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedCategories[category] && (
                      <tr id={`subcategories-${category}`} className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 animate-fade-in transition-colors duration-300">
                        <td colSpan={3} className="px-3 sm:px-6 py-4 sm:py-5">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pl-6 sm:pl-12">
                            <h4 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-emerald-50">Sub-category Sections</h4>
                            <button
                              onClick={() => handleAddSubCategorySectionClick(category)}
                              className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                            >
                              <Plus size={14} className="sm:w-4 sm:h-4" /> Add Section
                            </button>
                          </div>
                          <div className="pl-6 sm:pl-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-3 sm:gap-y-4 gap-x-4 sm:gap-x-6">
                            {/* Use (categoryHierarchy[category] || []) to ensure it's always an array */}
                            {(categoryHierarchy[category] || []).length > 0 ? (
                              (categoryHierarchy[category] || []).map(section => (
                                <div key={section.title} className="text-sm border border-slate-100 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900 shadow-sm transition-colors duration-300">
                                  <div className="flex justify-between items-center mb-2">
                                    <h5 className="font-bold text-slate-900 dark:text-emerald-50">{section.title}</h5>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleEditSubCategorySectionClick(category, section)}
                                        className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                        title="Edit Section"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSubCategorySectionClick(category, section.title)}
                                        className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                        title="Delete Section"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  <ul className="list-disc list-inside text-slate-600 dark:text-emerald-200 space-y-0.5 pl-4 transition-colors">
                                    {section.items.map(subItem => (
                                      <li key={subItem}>{subItem}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-emerald-300 col-span-full text-center py-4">No sub-category sections defined.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )) : (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-sm sm:text-lg text-slate-500 dark:text-emerald-300">No categories found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add New Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 w-full max-w-md shadow-xl border border-slate-100 dark:border-slate-800 relative">
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-emerald-50 mb-4 sm:mb-6 pr-8">Add New Category</h3>
            <input
              type="text"
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => { setNewCategoryName(e.target.value); setCategoryNameError(''); }}
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 mb-4"
            />
            {categoryNameError && <p className="text-red-500 text-xs sm:text-sm mb-4">{categoryNameError}</p>}
            <div className="flex flex-wrap justify-end gap-2 sm:gap-3">
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewCategory}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
              >
                Add Category
              </button>
            </div>
            <button
              onClick={() => setShowAddCategoryModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 w-full max-w-md shadow-xl border border-slate-100 dark:border-slate-800 relative">
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-emerald-50 mb-4 sm:mb-6 pr-8">Edit Category: {editingCategoryOldName}</h3>
            <input
              type="text"
              placeholder="New category name"
              value={editingCategoryNewName}
              onChange={(e) => { setEditingCategoryNewName(e.target.value); setEditingCategoryError(''); }}
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 mb-4"
            />
            {editingCategoryError && <p className="text-red-500 text-xs sm:text-sm mb-4">{editingCategoryError}</p>}
            <div className="flex flex-wrap justify-end gap-2 sm:gap-3">
              <button
                onClick={() => setShowEditCategoryModal(false)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedCategory}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
              >
                Save Changes
              </button>
            </div>
            <button
              onClick={() => setShowEditCategoryModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Add New Sub-Category Section Modal */}
      {showAddSubCategorySectionModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 w-full max-w-lg shadow-xl border border-slate-100 dark:border-slate-800 relative">
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-emerald-50 mb-4 sm:mb-6 pr-8">Add Section to {currentCategoryForSub}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Section Title</label>
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => { setNewSectionTitle(e.target.value); setNewSectionError(''); }}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                  placeholder="e.g. Gaming Gear"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">Items (comma separated)</label>
                <textarea
                  value={newSectionItems}
                  onChange={(e) => { setNewSectionItems(e.target.value); setNewSectionError(''); }}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm h-24 resize-y text-slate-900 dark:text-emerald-100"
                />
              </div>
            </div>
            {newSectionError && <p className="text-red-500 text-xs sm:text-sm mt-4">{newSectionError}</p>}
            <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mt-6">
              <button
                onClick={() => setShowAddSubCategorySectionModal(false)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewSubCategorySection}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
              >
                Add Section
              </button>
            </div>
            <button
              onClick={() => setShowAddSubCategorySectionModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Edit Sub-Category Section Modal */}
      {showEditSubCategorySectionModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 w-full max-w-lg shadow-xl border border-slate-100 dark:border-slate-800 relative">
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-emerald-50 mb-4 sm:mb-6 pr-8">Edit Section in {editingSubCategoryCategoryName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Section Title</label>
                <input
                  type="text"
                  value={editingSubCategorySectionTitle}
                  onChange={(e) => { setEditingSubCategorySectionTitle(e.target.value); setEditingSubCategoryError(''); }}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Items (comma separated)</label>
                <textarea
                  value={editingSubCategorySectionItems}
                  onChange={(e) => { setEditingSubCategorySectionItems(e.target.value); setEditingSubCategoryError(''); }}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm h-24 resize-y text-slate-900 dark:text-emerald-100"
                />
              </div>
            </div>
            {editingSubCategoryError && <p className="text-red-500 text-xs sm:text-sm mt-4">{editingSubCategoryError}</p>}
            <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mt-6">
              <button
                onClick={() => setShowEditSubCategorySectionModal(false)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedSubCategorySection}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
              >
                Save Changes
              </button>
            </div>
            <button
              onClick={() => setShowEditSubCategorySectionModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteCategoryConfirm}
        onClose={() => setShowDeleteCategoryConfirm(false)}
        onConfirm={confirmDeleteCategory}
        title="Delete Category?"
        message={`Are you sure you want to delete the category '${categoryToDelete}'? This action cannot be undone.`}
        confirmButtonText="Delete Category"
      />

      {/* Delete Sub-Category Section Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteSectionConfirm}
        onClose={() => setShowDeleteSectionConfirm(false)}
        onConfirm={confirmDeleteSubCategorySection}
        title="Delete Section?"
        message={`Are you sure you want to delete the section '${sectionToDelete}' from category '${categoryForSectionToDelete}'? This action cannot be undone.`}
        confirmButtonText="Delete Section"
      />
    </>
  );
};

export default AdminManageCategories;
