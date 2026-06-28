'use client';

import React, { useState, useEffect } from 'react';
import { FolderTree, Plus, Search, ChevronLeft, Tag } from 'lucide-react';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface AssetCategory {
  id: number;
  category_name: string;
  type_name?: string;
  type_name_ar?: string;
  type_code?: string;
  category_code?: string;
  category?: string;
  description?: string;
  parent_category_id?: number;
  depreciation_rate?: number;
  expected_lifetime_years?: number;
  useful_life_years?: number;
  asset_count?: number;
  is_active?: boolean;
}

export default function AssetCategoriesPage() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<AssetCategory | null>(null);
  const [formData, setFormData] = useState({
    category_name: '',
    category_code: '',
    description: '',
    parent_category_id: '',
    depreciation_rate: '',
    useful_life_years: ''
  });

  useEffect(() => {
    fetchCategories();
  }, []);
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/asset-categories', {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        const cats = (data.categories || []).map((c: any) => ({
          ...c,
          category_name: c.type_name_ar || c.type_name || c.category,
          category_code: c.type_code,
          useful_life_years: c.expected_lifetime_years,
        }));
        setCategories(cats);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/v1/hr-structure/asset-categories';
      const method = 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify({
          type_name: formData.category_name,
          type_name_ar: formData.category_name,
          type_code: formData.category_code || 'CAT-NEW',
          category: formData.category_code || 'general',
          description: formData.description,
        })
      });
      
      if (response.ok) {
        fetchCategories();
        setShowForm(false);
        setEditCategory(null);
        setFormData({
          category_name: '',
          category_code: '',
          description: '',
          parent_category_id: '',
          depreciation_rate: '',
          useful_life_years: ''
        });
      }
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const handleEdit = (category: AssetCategory) => {
    setEditCategory(category);
    setFormData({
      category_name: category.category_name,
      category_code: category.category_code || '',
      description: category.description || '',
      parent_category_id: category.parent_category_id?.toString() || '',
      depreciation_rate: category.depreciation_rate?.toString() || '',
      useful_life_years: category.useful_life_years?.toString() || ''
    });
    setShowForm(true);
  };

  const getCategoryType = (category: AssetCategory) => {
    return category.parent_category_id ? 'فئة فرعية' : 'فئة رئيسية';
  };

  const getParentName = (parentId?: number) => {
    if (!parentId) return '-';
    const parent = categories.find(c => c.id === parentId);
    return parent?.category_name || '-';
  };

  const filteredCategories = categories.filter(category =>
    category.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.category_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mainCategories = categories.filter(c => !c.parent_category_id).length;
  const subCategories = categories.filter(c => c.parent_category_id).length;
  const totalAssets = categories.reduce((sum, c) => sum + (c.asset_count || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/assets">الأصول</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">تصنيف الأصول</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <FolderTree className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">تصنيف الأصول</h1>
              <p className="text-slate-400 mt-1">إدارة فئات وتصنيفات الأصول</p>
            </div>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>فئة جديدة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الفئات</span>
              <FolderTree className="w-5 h-5 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{categories.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">فئات رئيسية</span>
              <FolderTree className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{mainCategories}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">فئات فرعية</span>
              <Tag className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{subCategories}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">عدد الأصول</span>
              <Tag className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{totalAssets}</div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم، الرمز، أو الوصف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-12 text-center">
                <FolderTree className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد فئات مسجلة بعد'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الرمز</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم الفئة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الفئة الأساسية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">معدل الاستهلاك</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">العمر الافتراضي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">عدد الأصول</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {category.category_code || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                        {category.category_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          category.parent_category_id 
                            ? 'text-emerald-400 bg-emerald-500/10' 
                            : 'text-blue-400 bg-blue-500/10'
                        }`}>
                          {getCategoryType(category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {getParentName(category.parent_category_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {category.depreciation_rate ? `${category.depreciation_rate}%` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {category.useful_life_years ? `${category.useful_life_years} سنة` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {category.asset_count || 0}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleEdit(category)}
                          className="px-3 py-1 bg-violet-600/20 text-violet-400 rounded-lg text-xs hover:bg-violet-600/30 transition-colors"
                        >
                          تعديل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-slate-100">
                {editCategory ? 'تعديل الفئة' : 'فئة جديدة'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">اسم الفئة *</label>
                  <input
                    type="text"
                    required
                    value={formData.category_name}
                    onChange={(e) => setFormData({...formData, category_name: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="مباني، معدات، مركبات..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">رمز الفئة</label>
                  <input
                    type="text"
                    value={formData.category_code}
                    onChange={(e) => setFormData({...formData, category_code: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="CAT-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  rows={3}
                  placeholder="وصف الفئة..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الفئة الأساسية</label>
                <select
                  value={formData.parent_category_id}
                  onChange={(e) => setFormData({...formData, parent_category_id: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                >
                  <option value="">لا يوجد (فئة رئيسية)</option>
                  {categories
                    .filter(c => !c.parent_category_id && c.id !== editCategory?.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.category_name}</option>
                    ))
                  }
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    معدل الاستهلاك السنوي (%)
                  </label>
                  <input
                    type="number"
                    value={formData.depreciation_rate}
                    onChange={(e) => setFormData({...formData, depreciation_rate: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="5.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    العمر الافتراضي (سنوات)
                  </label>
                  <input
                    type="number"
                    value={formData.useful_life_years}
                    onChange={(e) => setFormData({...formData, useful_life_years: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    min="1"
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                >
                  {editCategory ? 'تحديث' : 'حفظ'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditCategory(null);
                  }}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
