import { create } from 'zustand';
import { workspaceApi } from './apiService';

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  organization?: string;
  start_date?: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
}

export interface Site {
  id: number;
  name: string;
  site_type: string;
  code: string | null;
  latitude?: number;
  longitude?: number;
  status?: string;
  project_id?: number;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  sites: Site[];
  addProject: (project: Omit<Project, 'id' | 'created_at'>) => void;
  setActiveProject: (id: string) => void;
  deleteProject: (id: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  loadSites: (projectId: string | number) => Promise<void>;
  clearSites: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  sites: [],
  deleteProject: async (id) => {
    try {
      await workspaceApi.deleteProject(id);
      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        activeProjectId: state.activeProjectId === id ? (state.projects.filter(p => p.id !== id)[0]?.id || null) : state.activeProjectId
      }));
    } catch(e) {
      console.error(e);
    }
  },
  loadProjects: async () => {
    try {
      console.log('🔄 جاري تحميل المشاريع...');
      const response = await workspaceApi.getProjects();
      console.log('✅ RAW PROJECT RESPONSE from API:', response);
      let projectsArray = Array.isArray(response) ? response : (response && response.projects ? response.projects : []);
      
      // Ensure all IDs are strings (Backend sometimes returns integers, which breaks UI comparisons)
      projectsArray = projectsArray.map((p: any) => ({ ...p, id: String(p.id) }));
      
      console.log(`✅ EXAMINING fetched projects: isArray=${Array.isArray(projectsArray)}, length=${projectsArray.length}`);
      if(projectsArray.length > 0) {
         const firstId = String(projectsArray[0].id);
         set({ projects: projectsArray, activeProjectId: firstId });
         // Auto-load sites for the first project so MapCanvas can render markers immediately
         await get().loadSites(firstId);
      } else {
         set({ projects: [] }); 
      }
    } catch (e) { 
      console.error('❌ خطأ في تحميل المشاريع:', e);
    }
  },
  addProject: (proj) => {
    workspaceApi.createProject(proj).catch(console.error);
    set((state) => {
    const newProj = {
      ...proj,
      id: `proj-${Date.now()}`,
      created_at: new Date().toISOString()
    };
    return {
      projects: [newProj, ...state.projects],
      activeProjectId: newProj.id
    };
  });
  },
  setActiveProject: (id) => set({ activeProjectId: id }),
  loadSites: async (projectId) => {
    try {
      const data = await workspaceApi.getSites(projectId);
      const sitesArr = Array.isArray(data) ? data : [];
      console.log(`[projectStore] loadSites: ${sitesArr.length} مواقع للمشروع ${projectId}`);
      set({ sites: sitesArr });
    } catch (e) {
      console.error('[projectStore] loadSites خطأ:', e);
      set({ sites: [] });
    }
  },
  clearSites: () => set({ sites: [] }),
}));
