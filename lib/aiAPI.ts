/**
 * AI Assistant API Client - HYBRID AI SYSTEM
 * 
 * Handles all communication with Hybrid AI Backend:
 * - SQL Engine for data queries
 * - Groq for creative responses
 * - DeepSeek for polishing
 * - Report generation
 * 
 * Updated: 2026-03-17 - New routing for Hybrid AI
 */

// Backend API Base URL
// Use relative path if on same domain (production), or full URL for development
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const AI_API_BASE = `${API_BASE_URL}/api/v1/ai`;  // Keep legacy service base for non-ask endpoints

function resolveTenantHeaders(): Record<string, string> {
  const tenantCode =
    typeof window !== 'undefined'
      ? (window.localStorage.getItem('tenant_code') || window.localStorage.getItem('active_tenant_code') || '')
      : '';
  const userRole = typeof window !== 'undefined' ? (window.localStorage.getItem('user_role') || 'tenant_admin') : 'tenant_admin';

  const headers: Record<string, string> = {
    'X-User-Role': userRole,
    ...getClientTenantHeaders(),
  };
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

export interface AskRequest {
  question: string;
  mode?: 'auto' | 'sql' | 'chat' | 'report';
  context?: Record<string, any>;
  user_id?: string;
}

export interface EvidenceRecord {
  [key: string]: any;
}

export interface BrainAction {
  type: string;
  label: string;
  policy: 'auto' | 'approval' | 'blocked';
  payload?: Record<string, any>;
}

export interface BrainAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
  source?: string;
  [key: string]: any;
}

export interface BrainEntity {
  type: string;
  id?: string;
  name?: string;
  [key: string]: any;
}

export interface AskResponse {
  success: boolean;
  answer?: string;
  response?: string;
  // Sprint 0: BrainResponse contract fields
  source?: 'sql' | 'tool' | 'spatial' | 'monitoring' | 'llm_fallback' | 'memory_reuse' | string;
  evidence?: EvidenceRecord[];
  entities?: BrainEntity[];
  actions?: BrainAction[];
  alerts?: BrainAlert[];
  // existing fields
  data?: any[];
  sql?: string;
  mode_used?: string;
  confidence?: number;
  processing_time_ms?: number;
  error?: string;
  timestamp?: string;
  map_actions?: any[];
  metadata?: Record<string, any>;
}

export interface ReportRequest {
  topic: string;
  report_type?: 'comprehensive' | 'executive' | 'analytical';
  data?: Record<string, any>;
}

export interface ModelsStatus {
  groq: {
    available: boolean;
    model: string;
  };
  deepseek_local: {
    available: boolean;
    model: string | null;
    url: string;
  };
}

export class AIAssistantAPI {
  private baseUrl: string;
  private aiBaseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.aiBaseUrl = AI_API_BASE;
  }

  /**
   * 🚀 NEW: Hybrid AI Ask - Smart routing (SQL/Chat/Report)
   */
  async ask(request: AskRequest): Promise<AskResponse> {
    const url = `${this.baseUrl}/api/v1/ask`;
    const ctx = request.context || {};
    const payload = {
      question: request.question,
      mode: request.mode || 'auto',
      user_id: request.user_id || 'web_user',
      module: (ctx as any).module || 'ai-assistant',
      language: (ctx as any).language || 'ar',
      tenant_id: (ctx as any).tenant_id,
      user_role: (ctx as any).user_role,
      entity_type: (ctx as any).entity_type,
      project_id: (ctx as any).project_id,
      site_id: (ctx as any).site_id,
      lat: (ctx as any).lat,
      lon: (ctx as any).lon,
      context: typeof ctx === 'string' ? ctx : JSON.stringify(ctx),
    };

    // 🐛 DEBUG LOG
    console.log('🚀 [AI API] Sending request to:', url);
    console.log('📦 [AI API] Payload:', payload);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...resolveTenantHeaders(),
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 [AI API] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [AI API] Error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || 'Unknown error' };
        }
        
        throw new Error(errorData.detail || errorData.error || `Backend Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [AI API] Success response:', data);

      const answerText = data.answer ?? data.response;
      return {
        success: Boolean(answerText),
        answer: answerText,
        response: answerText,
        mode_used: data.mode || data.mode_used || 'orchestrator',
        confidence: data.confidence,
        processing_time_ms: data.processing_time_ms,
        error: data.error,
        timestamp: data.timestamp,
        map_actions: data.map_actions,
        metadata: data.metadata,
        data: data.data,
        // Sprint 0: BrainResponse contract fields
        source: data.source,
        evidence: data.evidence,
        entities: data.entities,
        actions: data.actions,
        alerts: data.alerts,
      };
    } catch (error: any) {
      console.error('💥 [AI API] Request failed:', error);
      throw error;
    }
  }

  /**
   * 🧠 Brain Direct — Direct SQL + Groq formatting (no hallucination)
   * Uses POST /api/v1/brain
   */
  async askDirect(question: string, context?: Record<string, any>): Promise<AskResponse> {
    const url = `${this.baseUrl}/api/v1/brain-v2`;
    console.log('🧠 [BRAIN_DIRECT] Sending to:', url, 'q=', question);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...resolveTenantHeaders(),
        },
        body: JSON.stringify({ question, context: context || {} }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [BRAIN_DIRECT] Error:', errorText);
        let errorData;
        try { errorData = JSON.parse(errorText); } catch { errorData = { detail: errorText }; }
        throw new Error(errorData.detail?.message || errorData.detail || `Brain Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [BRAIN_DIRECT] Response:', data);

      return {
        success: Boolean(data.answer),
        answer: data.answer,
        response: data.answer,
        mode_used: 'brain_direct',
        confidence: data.source === 'sql' ? 0.99 : 0.5,
        source: data.source,
        evidence: data.evidence || [],
        entities: [],
        actions: [],
        alerts: [],
        metadata: {
          intent: data.intent,
          count: data.count,
          latency_ms: data.latency_ms,
        },
      };
    } catch (error: any) {
      console.error('💥 [BRAIN_DIRECT] Request failed:', error);
      throw error;
    }
  }

  /**
   * 📊 NEW: Generate Report
   */
  async generateReport(request: ReportRequest): Promise<AskResponse> {
    const response = await fetch(`${this.aiBaseUrl}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...resolveTenantHeaders(),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Report generation failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * ✅ NEW: Health Check - Hybrid AI System
   */
  async health(): Promise<any> {
    const url = `${API_BASE_URL}/api/v1/system/health`;
    console.log('🏥 [AI API] Health check:', url);

    try {
      const response = await fetch(url, {
        headers: resolveTenantHeaders(),
      });
      console.log('🏥 [AI API] Health status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('❌ [AI API] Health check failed:', text);
        throw new Error(`Hybrid AI not responding: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [AI API] Health data:', data);
      return data;
    } catch (error: any) {
      console.error('💥 [AI API] Health check error:', error);
      throw error;
    }
  }

  /**
   * 📋 NEW: Get Available Models Status
   */
  async getModels(): Promise<ModelsStatus> {
    const response = await fetch(`${this.aiBaseUrl}/models`, {
      headers: resolveTenantHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Models endpoint not responding');
    }

    return response.json();
  }

  /**
   * 🧪 NEW: Test Groq directly
   */
  async testGroq(question: string): Promise<any> {
    const response = await fetch(`${this.aiBaseUrl}/test/groq`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...resolveTenantHeaders(),
      },
      body: JSON.stringify({ question }),
    });

    return response.json();
  }

  /**
   * 🧪 NEW: Test DeepSeek locally
   */
  async testDeepSeek(question: string): Promise<any> {
    const response = await fetch(`${this.aiBaseUrl}/test/deepseek`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...resolveTenantHeaders(),
      },
      body: JSON.stringify({ question }),
    });

    return response.json();
  }

  /**
   * 🔍 NEW: Execute SQL directly (dev only)
   */
  async executeSQLDirect(sql: string): Promise<any> {
    const response = await fetch(`${this.aiBaseUrl}/sql/direct?sql=${encodeURIComponent(sql)}`, {
      method: 'POST',
      headers: resolveTenantHeaders(),
    });

    return response.json();
  }

  /**
   * LEGACY: Submit feedback (keeping for backward compatibility)
   */
  async submitFeedback(request: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Feedback error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * LEGACY: Executive Chat (keeping for backward compatibility)
   */
  async executiveChat(message: string, userId: string, sessionData?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/executive/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user_id: userId,
        session_data: sessionData
      }),
    });

    if (!response.ok) {
      throw new Error(`Executive chat error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * LEGACY: Get backend health (old endpoint)
   */
  async getHealth(): Promise<any> {
    try {
      return await this.health();
    } catch {
      // Fallback to old endpoint
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error('Backend not responding');
      }
      return response.json();
    }
  }

  /**
   * DEPRECATED: Intelligence API endpoints (replaced by Hybrid AI)
   * Keeping for backward compatibility but will redirect to new system
   */
  async intelligenceAsk(question: string, focusArea?: string, projectId?: string): Promise<any> {
    console.warn('⚠️ intelligenceAsk is deprecated. Use ask() with mode="auto" instead.');
    return this.ask({
      question,
      mode: 'auto',
      context: { focus_area: focusArea, project_id: projectId }
    });
  }

  async intelligenceSummary(): Promise<any> {
    console.warn('⚠️ intelligenceSummary is deprecated. Use generateReport() instead.');
    return this.generateReport({
      topic: 'ملخص النظام',
      report_type: 'executive'
    });
  }

  async intelligenceHealth(): Promise<any> {
    console.warn('⚠️ intelligenceHealth is deprecated. Use health() instead.');
    return this.health();
  }
}

// Singleton instance
export const aiAPI = new AIAssistantAPI();
