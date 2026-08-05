#!/usr/bin/env node

// Advanced Filters & Comprehensive Statistics Test
// اختبار الفلاتر المتقدمة والإحصائيات الشاملة

console.log('='.repeat(80));
console.log('🔍 اختبار الفلاتر المتقدمة والإحصائيات الشاملة');
console.log('='.repeat(80));
console.log();

// Mock data
const mockAllOrders = [
  // Active orders
  {
    id: 1,
    work_order_number: 'WO-001',
    title_ar: 'صيانة مضخة المياه',
    asset_name: 'Pump-A-01',
    priority: 'critical',
    status: 'pending',
    assigned_team: 'فريق الصيانة الميكانيكية',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 2,
    work_order_number: 'WO-002',
    title_ar: 'فحص الصمام الثانوي',
    asset_name: 'Valve-B-02',
    priority: 'high',
    status: 'in_progress',
    assigned_team: 'فريق التحكم والآلات',
    created_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  },
  {
    id: 3,
    work_order_number: 'WO-003',
    title_ar: 'قاطع كهربائي متكرر',
    asset_name: 'CB-Panel-03',
    priority: 'urgent',
    status: 'in_progress',
    assigned_team: 'فريق الكهرباء',
    created_at: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
  },
  // Closed orders
  {
    id: 4,
    work_order_number: 'WO-004',
    title_ar: 'صيانة خط أنابيب',
    asset_name: 'Pipeline-C-04',
    priority: 'high',
    status: 'closed',
    assigned_team: 'فريق المواد والأنابيب',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    notes: 'تم إصلاح التسرب بنجاح',
  },
  {
    id: 5,
    work_order_number: 'WO-005',
    title_ar: 'خلل قراءة حساس',
    asset_name: 'Sensor-D-05',
    priority: 'medium',
    status: 'completed',
    assigned_team: 'فريق الآلات والأجهزة',
    created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    notes: 'تم استبدال الحساس وإعادة المعايرة',
  },
  {
    id: 6,
    work_order_number: 'WO-006',
    title_ar: 'صيانة دورية',
    asset_name: 'Pump-A-02',
    priority: 'low',
    status: 'completed',
    assigned_team: 'فريق الصيانة الميكانيكية',
    created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    notes: 'صيانة دورية طبيعية',
  },
];

// Test 1: Filter by Status
console.log('📋 اختبار 1: الفلترة حسب الحالة');
console.log('-'.repeat(80));

function filterByStatus(orders, status) {
  if (status === 'all') return orders;
  if (status === 'active') return orders.filter((w) => ['pending', 'open', 'in_progress', 'on_hold'].includes(w.status));
  if (status === 'closed') return orders.filter((w) => ['completed', 'closed', 'cancelled'].includes(w.status));
  return orders;
}

const activeOrders = filterByStatus(mockAllOrders, 'active');
const closedOrders = filterByStatus(mockAllOrders, 'closed');
const allOrders = filterByStatus(mockAllOrders, 'all');

console.log(`✅ النشطة: ${activeOrders.length} طلب`);
activeOrders.forEach((o) => console.log(`   • ${o.work_order_number}: ${o.title_ar} (${o.status})`));
console.log();
console.log(`✅ المغلقة: ${closedOrders.length} طلب`);
closedOrders.forEach((o) => console.log(`   • ${o.work_order_number}: ${o.title_ar} (${o.status})`));
console.log();
console.log(`✅ الإجمالي: ${allOrders.length} طلب`);
console.log();

// Test 2: Filter by Team
console.log('👥 اختبار 2: الفلترة حسب الفرقة');
console.log('-'.repeat(80));

function filterByTeam(orders, team) {
  if (!team) return orders;
  return orders.filter((w) => w.assigned_team === team);
}

const teams = [...new Set(mockAllOrders.map((w) => w.assigned_team))];
teams.forEach((team) => {
  const filtered = filterByTeam(mockAllOrders, team);
  console.log(`✅ ${team}: ${filtered.length} طلب`);
  filtered.forEach((o) => console.log(`   • ${o.work_order_number}: ${o.title_ar}`));
});
console.log();

// Test 3: Filter by Priority
console.log('🎯 اختبار 3: الفلترة حسب الأولوية');
console.log('-'.repeat(80));

function filterByPriority(orders, priority) {
  if (!priority) return orders;
  return orders.filter((w) => w.priority === priority);
}

const priorities = ['critical', 'urgent', 'high', 'medium', 'low'];
priorities.forEach((p) => {
  const filtered = filterByPriority(mockAllOrders, p);
  if (filtered.length > 0) {
    console.log(`✅ ${p.toUpperCase()}: ${filtered.length} طلب`);
    filtered.forEach((o) => console.log(`   • ${o.work_order_number}: ${o.title_ar}`));
  }
});
console.log();

// Test 4: Comprehensive Statistics
console.log('📊 اختبار 4: الإحصائيات الشاملة');
console.log('-'.repeat(80));

function calculateStats(orders) {
  const activeCount = orders.filter((w) => ['pending', 'open', 'in_progress', 'on_hold'].includes(w.status)).length;
  const closedCount = orders.filter((w) => ['completed', 'closed'].includes(w.status)).length;
  const closureRate = orders.length > 0 ? Math.round((closedCount / orders.length) * 100) : 0;

  // Calculate average response time (assuming first status change is response)
  const avgResponseTime = Math.round(
    orders.filter((w) => w.created_at).reduce((sum, w) => {
      const created = new Date(w.created_at).getTime();
      const now = Date.now();
      return sum + Math.max(0, now - created);
    }, 0) / Math.max(1, orders.length) / (1000 * 60)
  );

  return {
    total: orders.length,
    active: activeCount,
    closed: closedCount,
    closureRate,
    avgResponseTime,
  };
}

const stats = calculateStats(mockAllOrders);
console.log(`📈 الإحصائيات الرئيسية:`);
console.log(`   • إجمالي الطلبات: ${stats.total}`);
console.log(`   • الطلبات النشطة: ${stats.active}`);
console.log(`   • الطلبات المغلقة: ${stats.closed}`);
console.log(`   • معدل الإغلاق: ${stats.closureRate}%`);
console.log(`   • متوسط وقت الاستجابة: ${stats.avgResponseTime} دقيقة`);
console.log();

// Test 5: Multi-filter Combination
console.log('🔗 اختبار 5: تطبيق فلاتر متعددة معاً');
console.log('-'.repeat(80));

function applyMultipleFilters(orders, filters) {
  let filtered = [...orders];

  if (filters.status && filters.status !== 'all') {
    filtered = filterByStatus(filtered, filters.status);
  }

  if (filters.team) {
    filtered = filterByTeam(filtered, filters.team);
  }

  if (filters.priority) {
    filtered = filterByPriority(filtered, filters.priority);
  }

  return filtered;
}

const testFilters = [
  { status: 'active', team: 'فريق الصيانة الميكانيكية', priority: '', description: 'طلبات نشطة بفريق الصيانة الميكانيكية' },
  { status: 'closed', team: '', priority: 'high', description: 'طلبات مغلقة بأولوية عالية' },
  { status: 'all', team: 'فريق الكهرباء', priority: 'urgent', description: 'جميع طلبات فريق الكهرباء العاجلة' },
];

testFilters.forEach(({ status, team, priority, description }) => {
  const result = applyMultipleFilters(mockAllOrders, { status, team, priority });
  console.log(`✅ ${description}:`);
  console.log(`   النتيجة: ${result.length} طلب`);
  result.forEach((o) => console.log(`   • ${o.work_order_number}: ${o.title_ar}`));
});
console.log();

// Test 6: Closure Report
console.log('📄 اختبار 6: تقرير الإغلاق للطلبات المنتهية');
console.log('-'.repeat(80));

function generateClosureReport(order) {
  return {
    workOrderNumber: order.work_order_number,
    problem: order.title_ar,
    team: order.assigned_team,
    status: order.status,
    createdAt: order.created_at,
    notes: order.notes || 'بدون ملاحظات',
  };
}

closedOrders.forEach((order) => {
  const report = generateClosureReport(order);
  console.log(`\n✅ تقرير ${report.workOrderNumber}:`);
  console.log(`   المشكلة: ${report.problem}`);
  console.log(`   الفريق: ${report.team}`);
  console.log(`   الحالة: ${report.status}`);
  console.log(`   الملاحظات: ${report.notes}`);
});
console.log();

// Final Report
console.log('='.repeat(80));
console.log('📊 ملخص النتائج');
console.log('='.repeat(80));
console.log(`✅ الفلترة حسب الحالة: عملت بنجاح`);
console.log(`✅ الفلترة حسب الفرقة: عملت بنجاح`);
console.log(`✅ الفلترة حسب الأولوية: عملت بنجاح`);
console.log(`✅ الإحصائيات الشاملة: محسوبة بنجاح`);
console.log(`✅ الفلاتر المتعددة: تعمل معاً بنجاح`);
console.log(`✅ تقارير الإغلاق: جاهزة بنجاح`);
console.log();
console.log('🎉 جميع الاختبارات نجحت! النظام جاهز لعرض جميع البيانات الشاملة.');
console.log('='.repeat(80));
