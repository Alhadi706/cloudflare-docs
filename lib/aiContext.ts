/**
 * AI Assistant Context Manager
 * 
 * This module manages context switching for the AI Assistant based on:
 * 1. Current page/route
 * 2. Active service card
 * 3. User's last action
 * 4. Stored session data
 */

export type ContextMode = 
  | 'generic'       // مساعد عام
  | 'map'           // خرائط GIS
  | 'projects'      // إدارة المشاريع
  | 'assets'        // إدارة الأصول
  | 'maintenance'   // صيانة
  | 'work_orders'   // أوامر العمل
  | 'employees'     // الموظفون
  | 'finance'       // المالية
  | 'admin'         // الإدارة
  | 'executive';    // مركز القيادة

export interface AssistantContext {
  mode: ContextMode;
  page: string;
  lastAction?: string;
  projectId?: string;
  uploadedFiles?: string[];
  activeLayer?: string;
}

// Detect context from current page
export function detectContextFromRoute(pathname: string): ContextMode {
  // GIS and Maps
  if (pathname.includes('gis-sovereignty') || pathname.includes('engineering-workspace')) return 'map';
  
  // Projects
  if (pathname.includes('/projects')) return 'projects';
  
  // Assets
  if (pathname.includes('/assets')) return 'assets';
  
  // Maintenance
  if (pathname.includes('/maintenance')) return 'maintenance';
  
  // Work Orders
  if (pathname.includes('/work-orders')) return 'work_orders';
  
  // Employees/HR
  if (pathname.includes('/employees') || pathname.includes('/hr')) return 'employees';
  
  // Finance
  if (pathname.includes('/finance') || pathname.includes('/budgets')) return 'finance';
  
  // Admin Gateway
  if (pathname.includes('/admin-gateway')) return 'admin';
  
  // Executive Dashboard (root)
  if (pathname === '/' || pathname === '/dashboard') return 'executive';
  
  return 'generic';
}

// Get specialized tools for each context
export function getContextTools(mode: ContextMode): string[] {
  const tools = {
    generic: ['general_query', 'system_info', 'help'],
    map: ['query_projects', 'spatial_search', 'analyze_location', 'assets_on_map', 'project_details'],
    projects: ['project_status', 'budget_analysis', 'project_timeline', 'risk_assessment', 'team_allocation'],
    assets: ['asset_inventory', 'asset_condition', 'asset_location', 'maintenance_history', 'depreciation'],
    maintenance: ['maintenance_records', 'schedule_maintenance', 'preventive_analysis', 'cost_summary'],
    work_orders: ['work_order_status', 'assign_work', 'completion_tracking', 'resource_allocation'],
    employees: ['employee_list', 'attendance', 'performance_review', 'salary_info', 'skills_matrix'],
    finance: ['budget_query', 'expense_report', 'financial_analysis', 'invoice_management', 'cost_centers'],
    admin: ['all_modules', 'cross_domain_query', 'system_overview', 'user_management'],
    executive: ['kpi_dashboard', 'strategic_insights', 'full_system_overview', 'performance_metrics']
  };
  
  return tools[mode] || tools.generic;
}

// Get context-specific greeting
export function getContextGreeting(mode: ContextMode): string {
  const greetings = {
    generic: '👋 مرحباً! أنا المساعد الذكي الموحد. كيف يمكنني مساعدتك؟',
    
    map: '🗺️ مرحباً! أنا متخصص في الخرائط والمعلومات الجغرافية. يمكنني:\n• البحث عن مشاريع حسب الموقع\n• تحليل المواقع والمسافات\n• عرض الأصول على الخريطة\n• تفاصيل المشاريع والإحداثيات',
    
    projects: '📊 مرحباً! أنا متخصص في إدارة المشاريع. أستطيع مساعدتك في:\n• متابعة حالة المشاريع\n• تحليل الميزانيات والإنفاق\n• الجداول الزمنية والتأخيرات\n• تقييم المخاطر والفرص',
    
    assets: '🏗️ مرحباً! أنا متخصص في إدارة الأصول. يمكنني:\n• جرد الأصول وحالتها\n• مواقع الأصول GPS\n• سجل الصيانة والإهلاك\n• تحليل تكلفة الملكية',
    
    maintenance: '🔧 مرحباً! أنا متخصص في الصيانة. أستطيع:\n• عرض سجلات الصيانة\n• جدولة الصيانة الوقائية\n• تحليل التكاليف والتكرار\n• تتبع قطع الغيار',
    
    work_orders: '📋 مرحباً! أنا متخصص في أوامر العمل. يمكنني:\n• متابعة حالة الأوامر\n• تخصيص المهام للفنيين\n• تتبع الإنجاز والتأخيرات\n• تحليل الإنتاجية',
    
    employees: '👥 مرحباً! أنا متخصص في الموارد البشرية. أستطيع:\n• معلومات الموظفين والحضور\n• تقييم الأداء والمهارات\n• الرواتب والمزايا\n• التوزيع على المشاريع',
    
    finance: '💰 مرحباً! أنا متخصص في المالية. يمكنني:\n• تحليل الميزانيات والمصروفات\n• التقارير المالية الشاملة\n• إدارة الفواتير والمدفوعات\n• مراكز التكلفة والربحية',
    
    admin: '⚙️ مرحباً! أنا مساعدك الإداري الشامل. أستطيع:\n• الوصول لجميع الوحدات\n• استعلامات متعددة المجالات\n• نظرة عامة على النظام\n• إدارة المستخدمين والصلاحيات',
    
    executive: '🎯 مرحباً! أنا مساعد المركز التنفيذي. يمكنني:\n• لوحة مؤشرات الأداء KPI\n• رؤى استراتيجية ذكية\n• نظرة شاملة على كامل النظام\n• تحليلات الأداء والإنتاجية'
  };
  
  return greetings[mode] || greetings.generic;
}

// Store context in session
export function saveContext(context: AssistantContext): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('ai_context', JSON.stringify(context));
  }
}

// Load context from session
export function loadContext(): AssistantContext | null {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('ai_context');
    return stored ? JSON.parse(stored) : null;
  }
  return null;
}

// Build context payload for API
export function buildContextPayload(
  mode: ContextMode,
  additionalContext?: Record<string, any>
): Record<string, any> {
  const baseContext = {
    current_page: window.location.pathname,
    active_mode: mode,
    tools: getContextTools(mode),
    timestamp: new Date().toISOString()
  };
  
  return { ...baseContext, ...additionalContext };
}
